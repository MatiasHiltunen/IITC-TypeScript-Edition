import { COLORS, TEAM_ENL, TEAM_NAMES, TEAM_RES, TEAM_TO_CSS } from "./config";
import { dialog } from "./dialog";
import { addHook } from "./hooks";
import { postAjax } from "./send_request";
import { useAndroidPanes } from "./smartphone";
import { store } from "./store";
import { convertTextToTableMagic, digits } from "./utils_misc";
import $ from "jquery"
import { Team } from "./player";


class RegionScore {
    ori_data: any;
    topAgents: any;
    regionName: any;
    gameScore: any;
    median: number[];
    CP_COUNT: number;
    CP_DURATION: number;
    CYCLE_DURATION: number;
    checkpoints: any[];
    cycleStartTime: Date;

    constructor(serverResult) {
        this.ori_data = serverResult;
        this.topAgents = serverResult.topAgents;
        this.regionName = serverResult.regionName;
        this.gameScore = serverResult.gameScore;

        this.median = [-1, -1, -1];
        this.CP_COUNT = 35;
        this.CP_DURATION = 5 * 60 * 60 * 1000;
        this.CYCLE_DURATION = this.CP_DURATION * this.CP_COUNT;

        this.checkpoints = [];

        for (let i = 0; i < serverResult.scoreHistory.length; i++) {
            let h = serverResult.scoreHistory[i];
            this.checkpoints[parseInt(h[0])] = [parseInt(h[1]), parseInt(h[2])];
        }

        this.cycleStartTime = new Date(Math.floor(Date.now() / this.CYCLE_DURATION) * this.CYCLE_DURATION);

    }

    hasNoTopAgents = function () {
        return this.topAgents.length === 0;
    };

    getAvgScore = function (faction) {
        return parseInt(this.gameScore[faction === TEAM_ENL ? 0 : 1]);
    };

    getAvgScoreMax = function () {
        return Math.max(this.getAvgScore(TEAM_ENL), this.getAvgScore(TEAM_RES), 1);
    };

    getCPScore = function (cp) {
        return this.checkpoints[cp];
    };

    getScoreMax = function (min_value) {
        let max = min_value || 0;
        for (let i = 1; i < this.checkpoints.length; i++) {
            let cp = this.checkpoints[i];
            max = Math.max(max, cp[0], cp[1]);
        }
        return max;
    };

    getCPSum = function () {
        let sums = [0, 0];
        for (let i = 1; i < this.checkpoints.length; i++) {
            sums[0] += this.checkpoints[i][0];
            sums[1] += this.checkpoints[i][1];
        }

        return sums;
    };


    getAvgScoreAtCP = function (faction, cp_idx) {
        let idx = faction === TEAM_RES ? 1 : 0;

        let score = 0;
        let count = 0;
        let cp_len = Math.min(cp_idx, this.checkpoints.length);

        for (let i = 1; i <= cp_len; i++) {
            if (this.checkpoints[i] !== undefined) {
                score += this.checkpoints[i][idx];
                count++;
            }
        }

        if (count < cp_idx) {
            score += this.getScoreMedian(faction) * (cp_idx - count);
        }

        return Math.floor(score / cp_idx);
    };


    getScoreMedian = function (faction) {
        if (this.median[faction] < 0) {
            let idx = faction === TEAM_RES ? 1 : 0;
            let values = this.checkpoints.map(function (val) { return val[idx]; });
            values = values.filter(function (n) { return n !== undefined; });
            this.median[faction] = this.findMedian(values);
        }

        return this.median[faction];
    };

    findMedian = function (values) {
        let len = values.length;
        let rank = Math.floor((len - 1) / 2);

        if (len === 0) return 0;

        let l = 0,
            m = len - 1;
        let b, i, j, x;
        while (l < m) {
            x = values[rank];
            i = l;
            j = m;
            do {
                while (values[i] < x) i++;
                while (x < values[j]) j--;
                if (i <= j) {
                    b = values[i];
                    values[i] = values[j];
                    values[j] = b;
                    i++;
                    j--;
                }
            } while (i <= j);
            if (j < rank) l = i;
            if (rank < i) m = j;
        }
        return values[rank];
    };

    getLastCP = function (): number {
        if (this.checkpoints.length === 0) return 0;
        return this.checkpoints.length - 1;
    };

    getCycleEnd = function () {
        return this.getCheckpointEnd(this.CP_COUNT);
    };

    getCheckpointEnd = function (cp: number): number {
        return new Date(this.cycleStartTime.getTime() + this.CP_DURATION * cp).getTime();
    };


}

export class RegionScoreboard {

    mainDialog;
    regionScore: RegionScore;
    timer;


    showDialog() {

        let latLng = store.map.getCenter();

        let latE6 = Math.round(latLng.lat * 1E6);
        let lngE6 = Math.round(latLng.lng * 1E6);

        this.showRegion(latE6, lngE6);
    }


    /*
      function showScoreOf (region) {
        const latlng = regionToLatLong(region);
        const latE6 = Math.round(latLng.lat*1E6);
        const lngE6 = Math.round(latLng.lng*1E6);
        showRegion(latE6,lngE6);
      }
      */


    showRegion(latE6, lngE6) {
        let text = 'Loading regional scores...';

        if (useAndroidPanes()) {
            let style = 'position: absolute; top: 0; width: 100%; max-width: 412px';
            this.mainDialog = $('<div>', { style: style }).html(text).appendTo(document.body);
        } else {
            this.mainDialog = dialog({
                title: 'Region scores',
                html: text,
                width: 450,
                height: 340,
                closeCallback: this.onDialogClose
            });
        }

        postAjax('getRegionScoreDetails', { latE6: latE6, lngE6: lngE6 })
        .then(this.onRequestSuccess)
        .catch(this.onRequestFailure)

    }

    onRequestFailure() {
        this.mainDialog.html('Failed to load region scores - try again');
    }

    onRequestSuccess(data) {
        if (data.result === undefined) {
            return this.onRequestFailure();
        }

        this.regionScore = new RegionScore(data.result);
        this.updateDialog();
        this.startTimer();
    }


    updateDialog(logscale?) {

        this.mainDialog.html(
            '<div class="cellscore">' +
            '<b>Region scores for ' + this.regionScore.regionName + '</b>' +
            '<div class="historychart">' + this.createResults() + (new HistoryChart(this.regionScore, logscale)).svgImage() + '</div>' +
            '<b>Checkpoint overview</b><div>' + this.createHistoryTable() + '</div>' +
            '<b>Top agents</b><div>' + this.createAgentTable() + '</div>' +
            '</div>' +
            this.createTimers());

        this.setupToolTips();

        let tooltip = this.createResultTooltip();
        (<any>$('#overview', this.mainDialog)).tooltip({
            content: convertTextToTableMagic(tooltip)
        });

        (<any>$('.cellscore', this.mainDialog)).accordion({
            header: 'b',
            heightStyle: 'fill'
        });

        (<any>$('input.logscale', this.mainDialog)).change(function () {
            let input = $(this);

            this.updateDialog(input.prop('checked'));
        });
    }


    setupToolTips() {
        (<any>$('g.checkpoint', this.mainDialog)).each(function (i, elem: any) {
            elem = $(elem);

            function formatScore(idx, score_now, score_last) {
                if (!score_now[idx]) return '';
                let res = digits(score_now[idx]).toString();
                if (score_last && score_last[idx]) {
                    let delta = score_now[idx] - score_last[idx];
                    res += '\t(';
                    if (delta > 0) res += '+';
                    res += digits(delta) + ')';
                }
                return res;
            }

            let tooltip;
            let cp = parseInt(elem.attr('data-cp'));
            if (cp) {
                let score_now = this.regionScore.getCPScore(cp);
                let score_last = this.regionScore.getCPScore(cp - 1);
                let enl_str = score_now ? '\nEnl:\t' + formatScore(0, score_now, score_last) : '';
                let res_str = score_now ? '\nRes:\t' + formatScore(1, score_now, score_last) : '';
                tooltip = 'CP:\t' + cp + '\t-\t' + this.formatDayHours(this.regionScore.getCheckpointEnd(cp)) +
                    '\n<hr>' + enl_str + res_str;
            }

            elem.tooltip({
                content: convertTextToTableMagic(tooltip),
                position: { my: 'center bottom', at: 'center top-10' },
                tooltipClass: 'checkpointtooltip',
                show: 100
            });
        });
    }


    onDialogClose() {
        this.stopTimer();
    }


    createHistoryTable() {
      
        let _invert = store.PLAYER.team === Team.RESISTANCE;

        function order(_1, _2) {
            return (_invert ? [_2, _1] : [_1, _2]).join('');
        }
        let enl = { class: TEAM_TO_CSS[TEAM_ENL], name: TEAM_NAMES[TEAM_ENL] };
        let res = { class: TEAM_TO_CSS[TEAM_RES], name: TEAM_NAMES[TEAM_RES] };

        let table = '<table class="checkpoint_table"><thead>' +
            '<tr><th>CP</th><th>Time</th>' + order('<th>' + enl.name + '</th>', '<th>' + res.name + '</th>') + '</tr>';

        let total = this.regionScore.getCPSum();
        table += '<tr class="cp_total"><th></th><th></th>' +
            order(
                '<th class="' + enl.class + '">' + digits(total[0]) + '</th>',
                '<th class="' + res.class + '">' + digits(total[1]) + '</th>'
            ) + '</tr></thead>';

        for (let cp = this.regionScore.getLastCP(); cp > 0; cp--) {
            let score = this.regionScore.getCPScore(cp);
            let class_e = score[0] > score[1] ? ' class="' + enl.class + '"' : '';
            let class_r = score[1] > score[0] ? ' class="' + res.class + '"' : '';

            table += '<tr>' +
                '<td>' + cp + '</td>' +
                '<td>' + this.formatDayHours(this.regionScore.getCheckpointEnd(cp)) + '</td>' +
                order(
                    '<td' + class_e + '>' + digits(score[0]) + '</td>',
                    '<td' + class_r + '>' + digits(score[1]) + '</td>'
                ) + '</tr>';
        }

        table += '</table>';
        return table;
    }


    createAgentTable() {
        let agentTable = '<table><tr><th>#</th><th>Agent</th></tr>';

        for (let i = 0; i < this.regionScore.topAgents.length; i++) {
            let agent = this.regionScore.topAgents[i];
            agentTable += '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td class="nickname ' + (agent.team === 'RESISTANCE' ? 'res' : 'enl') + '">' + agent.nick + '</td></tr>';
        }

        if (this.regionScore.hasNoTopAgents()) {
            agentTable += '<tr><td colspan="2"><i>no top agents</i></td></tr>';
        }
        agentTable += '</table>';

        return agentTable;
    }


    createResults() {

        let maxAverage = this.regionScore.getAvgScoreMax();

        let order = (store.PLAYER.team === Team.ENLIGHTENED ? [TEAM_ENL, TEAM_RES] : [TEAM_RES, TEAM_ENL]);

        let result = '<table id="overview" title="">';
        for (let t = 0; t < 2; t++) {
            let faction = order[t];
            let team = TEAM_NAMES[faction];
            let teamClass = TEAM_TO_CSS[faction];
            let teamCol = COLORS[faction];
            let barSize = Math.round(this.regionScore.getAvgScore(faction) / maxAverage * 100);
            result += '<tr><th class="' + teamClass + '">' + team + '</th>' +
                '<td class="' + teamClass + '">' + digits(this.regionScore.getAvgScore(faction)) + '</td>' +
                '<td style="width:100%"><div style="background:' + teamCol + '; width: ' + barSize + '%; height: 1.3ex; border: 2px outset ' + teamCol + '; margin-top: 2px"> </td>' +
                '<td class="' + teamClass + '"><small>( ' + digits(this.regionScore.getAvgScoreAtCP(faction, 35)) + ' )</small></td>' +
                '</tr>';
        }

        return result + '</table>';
    }

    createResultTooltip() {

        let e_res = this.regionScore.getAvgScoreAtCP(TEAM_RES, this.regionScore.CP_COUNT);
        let e_enl = this.regionScore.getAvgScoreAtCP(TEAM_ENL, this.regionScore.CP_COUNT);
        let loosing_faction = e_res < e_enl ? TEAM_RES : TEAM_ENL;

        let order = (loosing_faction === TEAM_ENL ? [TEAM_RES, TEAM_ENL] : [TEAM_ENL, TEAM_RES]);

        function percentToString(score, total) {
            if (total === 0) return '50%';
            return (Math.round(score / total * 10000) / 100) + '%';
        }

        function currentScore() {
            let res = 'Current:\n';
            let total = this.regionScore.getAvgScore(TEAM_RES) + this.regionScore.getAvgScore(TEAM_ENL);
            for (let t = 0; t < 2; t++) {
                let faction = order[t];
                let score = this.regionScore.getAvgScore(faction);
                res += TEAM_NAMES[faction] + '\t' +
                    digits(score) + '\t' +
                    percentToString(score, total) + '\n';
            }

            return res;
        }

        function estimatedScore() {
            let res = '<hr>Estimated:\n';
            let total = e_res + e_enl;
            for (let t = 0; t < 2; t++) {
                let faction = order[t];
                let score = this.regionScore.getAvgScoreAtCP(faction, this.regionScore.CP_COUNT);
                res += TEAM_NAMES[faction] + '\t' +
                    digits(score) + '\t' +
                    percentToString(score, total) + '\n';
            }

            return res;
        }

        function requiredScore() {
            let res = '';
            let required_mu = Math.abs(e_res - e_enl) * this.regionScore.CP_COUNT + 1;
            res += '<hr>\n';
            res += TEAM_NAMES[loosing_faction] + ' requires:\t' + digits(Math.ceil(required_mu)) + ' \n';
            res += 'Checkpoint(s) left:\t' + (this.regionScore.CP_COUNT - this.regionScore.getLastCP()) + ' \n';

            return res;
        }

        return currentScore() + estimatedScore() + requiredScore();
    }


    createTimers() {
        let nextcp = this.regionScore.getCheckpointEnd(this.regionScore.getLastCP() + 1);
        let endcp = this.regionScore.getCycleEnd();

        return '<div class="checkpoint_timers"><table><tr>' +
            '<td>Next CP at: ' + this.formatHours(nextcp) + ' (in <span id="cycletimer"></span>)</td>' +
            '<td>Cycle ends: ' + this.formatDayHours(endcp) + '</td>' +
            '</tr></table></div>';
    }

    startTimer() {
        this.stopTimer();

        this.timer = window.setInterval(this.onTimer, 1000);
        this.onTimer();
    }

    stopTimer() {
        if (this.timer) {
            window.clearInterval(this.timer);
            this.timer = undefined;
        }
    }

    onTimer() {
        let d = this.regionScore.getCheckpointEnd(+this.regionScore.getLastCP() + 1) - (new Date()).getTime();
        /*  $('#cycletimer', this.mainDialog).html(this.formatMinutes(Math.max(0, Math.floor(d / 1000)))); */
    }

    formatMinutes(sec) {
        let hours = Math.floor(sec / 3600);
        let minutes = Math.floor((sec % 3600) / 60);
        sec = sec % 60;

        let time = '';
        time += hours + ':';
        if (minutes < 10) time += '0';
        time += minutes;
        time += ':';
        if (sec < 10) time += '0';
        time += sec;
        return time;
    }

    formatHours(time) {
        return ('0' + time.getHours()).slice(-2) + ':00';
    }

    formatDayHours(time) {
        return ('0' + time.getDate()).slice(-2) + '.' + ('0' + (time.getMonth() + 1)).slice(-2) + ' ' + ('0' + time.getHours()).slice(-2) + ':00';
    }

    setup() {
        if (useAndroidPanes()) {
            // @ts-ignore
            android.addPane('regionScoreboard', 'Region scores', 'ic_action_view_as_list');
            addHook('paneChanged', function (pane) {
                if (pane === 'regionScoreboard') {
                    this.showDialog();
                } else if (this.mainDialog) {
                    this.mainDialog.remove();
                }
            });
        } else {
            $('<a>')
                .html('Region scores')
                .attr('title', 'View regional scoreboard')
                .click(this.showDialog)
                .appendTo('#toolbox');
        }
    }


}


class HistoryChart {
    regionScore;
    scaleFct;
    logscale;
    svgTickText;
    svg;

    constructor(_regionScore, logscale) {
        this.regionScore = _regionScore;

        let max = this.regionScore.getScoreMax(10); //NOTE: ensure a min of 10 for the graph
        max *= 1.09; // scale up maximum a little, so graph isn't squashed right against upper edge
        this.setScaleType(max, logscale);

        this.svgTickText = [];

        // svg area 400x130. graph area 350x100, offset to 40,10
        this.svg = '<div><svg width="400" height="133" style="margin-left: 10px;">' +
            this.svgBackground() +
            this.svgAxis(max) +
            this.svgAveragePath() +
            this.svgFactionPath() +
            this.svgCheckPointMarkers() +
            this.svgTickText.join('') +
            '<foreignObject height="18" width="60" y="113" x="0" class="node"><label title="Logarithmic scale">' +
            '<input type="checkbox" class="logscale"' + (logscale ? ' checked' : '') + '/>' +
            'log</label></foreignObject>' +
            '</svg></div>';

    }

    svgImage() {
        return this.svg;
    }

    svgFactionPath() {

        let svgPath = '';

        for (let t = 0; t < 2; t++) {

            let col = this.getFactionColor(t);
            let teamPaths = [];

            for (let cp = 1; cp <= this.regionScore.getLastCP(); cp++) {

                let score = this.regionScore.getCPScore(cp);
                if (score !== undefined) {
                    let x = cp * 10 + 40;
                    teamPaths.push(x + ',' + this.scaleFct(score[t]));
                }
            }

            if (teamPaths.length > 0) {
                svgPath += '<polyline points="' + teamPaths.join(' ') + '" stroke="' + col + '" fill="none" />';
            }
        }

        return svgPath;
    }

    svgCheckPointMarkers() {

        let markers = '';

        let col1 = this.getFactionColor(0);
        let col2 = this.getFactionColor(1);

        for (let cp = 1; cp <= this.regionScore.CP_COUNT; cp++) {
            let scores = this.regionScore.getCPScore(cp);

            markers +=
                '<g title="dummy" class="checkpoint" data-cp="' + cp + '">' +
                '<rect x="' + (cp * 10 + 35) + '" y="10" width="10" height="100" fill="black" fill-opacity="0" />';

            if (scores) {
                markers +=
                    '<circle cx="' + (cp * 10 + 40) + '" cy="' + this.scaleFct(scores[0]) + '" r="3" stroke-width="1" stroke="' + col1 + '" fill="' + col1 + '" fill-opacity="0.5" />' +
                    '<circle cx="' + (cp * 10 + 40) + '" cy="' + this.scaleFct(scores[1]) + '" r="3" stroke-width="1" stroke="' + col2 + '" fill="' + col2 + '" fill-opacity="0.5" />';
            }

            markers += '</g>';
        }

        return markers;
    }

    svgBackground() {
        return '<rect x="0" y="1" width="400" height="132" stroke="#FFCE00" fill="#08304E" />';
    }

    svgAxis(max) {
        return '<path d="M40,110 L40,10 M40,110 L390,110" stroke="#fff" />' + this.createTicks(max);
    }

    createTicks(max) {
        let ticks = this.createTicksHorz();

        function addVTick(i) {
            let y = this.scaleFct(i);

            ticks.push('M40,' + y + ' L390,' + y);
            this.svgTickText.push('<text x="35" y="' + y + '" font-size="12" font-family="Roboto, Helvetica, sans-serif" text-anchor="end" fill="#fff">' + this.formatNumber(i) + '</text>');
        }

        // vertical
        // first we calculate the power of 10 that is smaller than the max limit
        let vtickStep = Math.pow(10, Math.floor(Math.log10(max)));
        if (this.logscale) {
            for (let i = 0; i < 4; i++) {

                addVTick(vtickStep);
                vtickStep /= 10;
            }
        } else {
            // this could be between 1 and 10 grid lines - so we adjust to give nicer spacings
            if (vtickStep < (max / 5)) {
                vtickStep *= 2;
            } else if (vtickStep > (max / 2)) {
                vtickStep /= 2;
            }

            for (let ti = vtickStep; ti <= max; ti += vtickStep) {
                addVTick(ti);
            }
        }

        return ('<path d="' + ticks.join(' ') + '" stroke="#fff" opacity="0.3" />');
    }

    createTicksHorz() {
        let ticks = [];
        for (let i = 5; i <= 35; i += 5) {
            let x = i * 10 + 40;
            ticks.push('M' + x + ',10 L' + x + ',110');
            this.svgTickText.push('<text x="' + x + '" y="125" font-size="12" font-family="Roboto, Helvetica, sans-serif" text-anchor="middle" fill="#fff">' + i + '</text>');
        }

        return ticks;
    }

    svgAveragePath() {
        let path = '';
        for (let faction = 1; faction < 3; faction++) {
            let col = COLORS[faction];

            let points = [];
            for (let cp = 1; cp <= this.regionScore.CP_COUNT; cp++) {
                let score = this.regionScore.getAvgScoreAtCP(faction, cp);

                let x = cp * 10 + 40;
                let y = this.scaleFct(score);
                points.push(x + ',' + y);
            }

            path += '<polyline points="' + points.join(' ') + '" stroke="' + col + '" stroke-dasharray="3,2" opacity="0.8" fill="none"/>';
        }

        return path;
    }

    setScaleType(max, useLogScale) {

        this.logscale = useLogScale;
        if (useLogScale) {
            if (!Math.log10)
                Math.log10 = function (x) { return Math.log(x) / Math.LN10; };

            // 0 cannot be displayed on a log scale, so we set the minimum to 0.001 and divide by lg(0.001)=-3
            this.scaleFct = function (y) { return Math.round(10 - Math.log10(Math.max(0.001, y / max)) / 3 * 100); };
        } else {
            this.scaleFct = function (y) { return Math.round(110 - y / max * 100); };
        }
    }

    getFactionColor(t) {
        return (t === 0 ? COLORS[TEAM_ENL] : COLORS[TEAM_RES]);
    }

    formatNumber(num) {
        return (num >= 1000000000 ? (num / 1000000000) + 'B' :
            num >= 1000000 ? (num / 1000000) + 'M' :
                num >= 1000 ? (num / 1000) + 'k' :
                    num);
    }



}