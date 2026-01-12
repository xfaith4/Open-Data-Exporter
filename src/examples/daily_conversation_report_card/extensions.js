var _ = require('lodash');

function DailyConversationReportCard() {}

function safeNumber(x, fallback) {
	if (fallback === undefined) fallback = 0;
	if (x === null || x === undefined) return fallback;
	if (typeof x === 'number') return x;
	var n = Number(x);
	return Number.isFinite(n) ? n : fallback;
}

function safeDivide(n, d, fallback) {
	if (fallback === undefined) fallback = 0;
	var nn = safeNumber(n, 0);
	var dd = safeNumber(d, 0);
	if (dd === 0) return fallback;
	return nn / dd;
}

function getMetricMap(metricsArray, defaults) {
	var map = _.cloneDeep(defaults || {});
	_.forEach(metricsArray || [], function(metric) {
		map[metric.metric] = metric;
	});
	return map;
}

function defaultQueueMetrics() {
	return {
		"nOffered": { "metric": "nOffered", "stats": { "count": 0 } },
		"tAnswered": { "metric": "tAnswered", "stats": { "count": 0, "sum": 0 } },
		"tAbandon": { "metric": "tAbandon", "stats": { "count": 0, "sum": 0 } },
		"tWait": { "metric": "tWait", "stats": { "count": 0, "sum": 0 } },
		"tHandle": { "metric": "tHandle", "stats": { "count": 0, "sum": 0 } },
		"nOverSla": { "metric": "nOverSla", "stats": { "count": 0 } },
		"tShortAbandon": { "metric": "tShortAbandon", "stats": { "count": 0 } },
		"tFlowOut": { "metric": "tFlowOut", "stats": { "count": 0 } },
		"oServiceLevel": { "metric": "oServiceLevel", "stats": { "ratio": 0, "numerator": 0, "denominator": 0, "target": 0 } },
		"oServiceTarget": { "metric": "oServiceTarget", "stats": { "target": 0 } }
	};
}

/**
 * Builds data.queues map from getQueues response.
 */
DailyConversationReportCard.prototype.flattenQueueData = function(data) {
	data.queues = {};
	if (!data.get_queues || !data.get_queues.entities) return;
	_.forEach(data.get_queues.entities, function(queue) {
		data.queues[queue.id] = queue;
	});
};

/**
 * Assigns conversation.customerParticipant, conversation.customerParticipant.ani, and conversation.queue
 * for each conversation in a conversation detail query.
 */
DailyConversationReportCard.prototype.setCustomerParticipants = function(data) {
	if (!data || !data.conversations) return;
	_.forEach(data.conversations, function(conversation) {
		conversation.customerParticipant = {};
		conversation.queue = {};
		_.forEach(conversation.participants || [], function(participant) {
			if (participant.purpose === 'customer') {
				conversation.customerParticipant = participant;
				_.forEach(conversation.customerParticipant.sessions || [], function(session) {
					if (session.ani) conversation.customerParticipant.ani = session.ani;
					if (session.dnis) conversation.customerParticipant.dnis = session.dnis;
				});
			} else if (participant.purpose === 'acd') {
				conversation.queue = participant;
			}
		});
	});
};

/**
 * Produces a report-friendly object at data.report with:
 *  - totals
 *  - queues (decorated per-queue rows)
 *  - worstQueues (lowest service level)
 *  - recentAbandons (from the conversation detail sample)
 */
DailyConversationReportCard.prototype.prepareReport = function(data) {
	data.report = data.report || {};

	// 1) Queue lookup
	this.flattenQueueData(data);
	var queueMap = data.queues || {};

	// 2) Decorate aggregate results
	var results = (data.daily_voice_queue_agg && data.daily_voice_queue_agg.results) ? data.daily_voice_queue_agg.results : [];
	var rows = [];

	// Totals accumulators
	var tot = {
		offered: 0,
		answered: 0,
		abandoned: 0,
		overSla: 0,
		shortAbandons: 0,
		flowOut: 0,
		answeredWaitSum: 0,
		answeredWaitCount: 0,
		handleSum: 0,
		handleCount: 0,
		slNumerator: 0,
		slDenominator: 0
	};

	_.forEach(results, function(r) {
		var queueId = r.group && r.group.queueId ? r.group.queueId : undefined;
		var q = queueId && queueMap[queueId] ? queueMap[queueId] : { id: queueId || 'unknown', name: queueId || 'unknown' };

		var metricsArray = (r.data && r.data[0] && r.data[0].metrics) ? r.data[0].metrics : [];
		var metrics = getMetricMap(metricsArray, defaultQueueMetrics());

		var offered = safeNumber(metrics.nOffered.stats.count, 0);
		var answered = safeNumber(metrics.tAnswered.stats.count, 0);
		var abandoned = safeNumber(metrics.tAbandon.stats.count, 0);
		var overSla = safeNumber(metrics.nOverSla.stats.count, 0);
		var shortAbandons = safeNumber(metrics.tShortAbandon.stats.count, 0);
		var flowOut = safeNumber(metrics.tFlowOut.stats.count, 0);

		var answeredWaitSum = safeNumber(metrics.tAnswered.stats.sum, 0);
		var answeredWaitCount = safeNumber(metrics.tAnswered.stats.count, 0);
		var handleSum = safeNumber(metrics.tHandle.stats.sum, 0);
		var handleCount = safeNumber(metrics.tHandle.stats.count, 0);

		var slNum = safeNumber(metrics.oServiceLevel.stats.numerator, 0);
		var slDen = safeNumber(metrics.oServiceLevel.stats.denominator, 0);
		var slRatio = safeNumber(metrics.oServiceLevel.stats.ratio, 0);
		if (slDen === 0 && slNum > 0) slDen = slNum; // defensive
		if (slRatio === 0 && slDen > 0) slRatio = safeDivide(slNum, slDen, 0);

		var row = {
			queue: q,
			queueId: q.id,
			metrics: metrics,
			offered: offered,
			answered: answered,
			abandoned: abandoned,
			overSla: overSla,
			shortAbandons: shortAbandons,
			flowOut: flowOut,
			asaSeconds: Math.round(safeDivide(answeredWaitSum, answeredWaitCount, 0)),
			ahtSeconds: Math.round(safeDivide(handleSum, handleCount, 0)),
			serviceLevelRatio: slRatio,
			serviceLevelPercent: Math.round(slRatio * 100)
		};

		rows.push(row);

		// Totals
		tot.offered += offered;
		tot.answered += answered;
		tot.abandoned += abandoned;
		tot.overSla += overSla;
		tot.shortAbandons += shortAbandons;
		tot.flowOut += flowOut;
		tot.answeredWaitSum += answeredWaitSum;
		tot.answeredWaitCount += answeredWaitCount;
		tot.handleSum += handleSum;
		tot.handleCount += handleCount;
		tot.slNumerator += slNum;
		tot.slDenominator += slDen;
	});

	// 3) Totals calculations
	data.report.totals = {
		offered: tot.offered,
		answered: tot.answered,
		abandoned: tot.abandoned,
		overSla: tot.overSla,
		shortAbandons: tot.shortAbandons,
		flowOut: tot.flowOut,
		abandonRatePercent: Math.round(safeDivide(tot.abandoned, tot.offered, 0) * 1000) / 10,
		asaSeconds: Math.round(safeDivide(tot.answeredWaitSum, tot.answeredWaitCount, 0)),
		ahtSeconds: Math.round(safeDivide(tot.handleSum, tot.handleCount, 0)),
		serviceLevelRatio: safeDivide(tot.slNumerator, tot.slDenominator, 0),
		serviceLevelPercent: Math.round(safeDivide(tot.slNumerator, tot.slDenominator, 0) * 100)
	};

	// 4) Sort helpers
	data.report.queues = _.orderBy(rows, ['offered'], ['desc']);
	data.report.worstQueues = _.take(_.orderBy(rows, ['serviceLevelRatio', 'offered'], ['asc', 'desc']), 10);

	// 5) Recent abandons (sample)
	var abandons = [];
	if (data.daily_abandons_detail && data.daily_abandons_detail.conversations) {
		_.forEach(data.daily_abandons_detail.conversations, function(c) {
			abandons.push({
				conversationId: c.conversationId,
				conversationStart: c.conversationStart,
				queueName: (c.queue && c.queue.participantName) ? c.queue.participantName : '',
				ani: (c.customerParticipant && c.customerParticipant.ani) ? c.customerParticipant.ani : '',
				dnis: (c.customerParticipant && c.customerParticipant.dnis) ? c.customerParticipant.dnis : ''
			});
		});
	}
	data.report.recentAbandons = _.take(abandons, 25);
};

module.exports = new DailyConversationReportCard();
