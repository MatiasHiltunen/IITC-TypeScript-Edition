import { CHAT_REQUEST_SCROLL_TOP, COLORS, TEAM_ENL, TEAM_RES } from "./config";
import { runHooks } from "./hooks";
import { addResumeFunction, isIdle } from "./idle";
import { requests, startRefreshTimeout } from "./request_handling";
import { postAjax } from "./send_request";
import { isSmartphone } from "./smartphone";
import { renderUpdateStatus } from "./status_bar";
import { store } from "./store";
import { clampLatLngBounds, makePermalink, scrollBottom, uniqueArray, unixTimeToDateTimeString, unixTimeToHHmm } from "./utils_misc";
import $ from "jquery"
import { Team } from "./player";

export class Chat {

  //WORK IN PROGRESS - NOT YET USED!!
  /*   commTabs = [
      // channel: the COMM channel ('tab' parameter in server requests)
      // name: visible name
      // inputPrompt: string for the input prompt
      // inputColor: (optional) color for input
      // sendMessage: (optional) function to send the message (to override the default of sendPlext)
      // globalBounds: (optional) if true, always use global latLng bounds
      { channel: 'all', name: 'All', inputPrompt: 'broadcast:', inputColor: '#f66' },
      { channel: 'faction', name: 'Aaction', inputPrompt: 'tell faction:' },
      {
        channel: 'alerts', name: 'Alerts', inputPrompt: 'tell Jarvis:', inputColor: '#666', globalBounds: true, sendMessage: function () {
          alert("Jarvis: A strange game. The only winning move is not to play. How about a nice game of chess?\n(You can't chat to the 'alerts' channel!)");
        }
      },
    ]; */
  private _oldBBox?: any;
  private _requestFactionRunning: boolean;
  _public: { data: {}, oldestTimestamp: number, newestTimestamp: number, oldestGUID?: string, };
  _alerts: { data: {}, oldestTimestamp: number, newestTimestamp: number };
  _faction: { data: {}, oldestTimestamp: number, newestTimestamp: number, oldestGUID?: string };
  backgroundInstanceChannel: any;
  backgroundChannels: {};



  constructor() {

    this._oldBBox = null;
    this._requestFactionRunning = false;
    this._public = { data: {}, oldestTimestamp: -1, newestTimestamp: -1, oldestGUID: null, };
    this._alerts = { data: {}, oldestTimestamp: -1, newestTimestamp: -1 };
    this._faction = { data: {}, oldestTimestamp: -1, newestTimestamp: -1, oldestGUID: null };
    if (window.localStorage['iitc-chat-tab']) {
      this.chooseTab(window.localStorage['iitc-chat-tab']);
    }

    $('#chatcontrols, #chat, #chatinput').show();

    $('#chatcontrols a:first').on("click", this.toggle);


    $('#chatcontrols a').each((ind, elm) => {
      if ($.inArray($(elm).text(), ['all', 'faction', 'alerts']) !== -1)

        $(elm).on('click', (e) => this.chooser(e));
    });

    $('#chatinput').on("click", () => {
      $('#chatinput input').focus();
    });

    this.setupTime();
    this.setupPosting();

    $('#chatfaction').on("scroll", () => {
      let t = $('#chatfaction');
      if (t.data('ignoreNextScroll')) return t.data('ignoreNextScroll', false);

      if (t.scrollTop() < CHAT_REQUEST_SCROLL_TOP) this.requestFaction(true, false);

      if (scrollBottom(t) === 0) this.requestFaction(false, false);
    });



    $('#chatall').on("scroll", () => {
      let t = $('#chatall');
      if (t.data('ignoreNextScroll')) return t.data('ignoreNextScroll', false);

      if (t.scrollTop() < CHAT_REQUEST_SCROLL_TOP) this.requestPublic(true, false);

      if (scrollBottom(t) === 0) this.requestPublic(false, false);
    });

    $('#chatalerts').on("scroll", () => {
      let t = $('#chatalerts');
      if (t.data('ignoreNextScroll')) return t.data('ignoreNextScroll', false);

      if (t.scrollTop() < CHAT_REQUEST_SCROLL_TOP) this.renderAlerts(true);

      if (scrollBottom(t) === 0) this.renderAlerts(false);
    });

    requests.addRefreshFunction(this.request);

    $('#chatinput mark').addClass(store.PLAYER.cls);

    $(document).on('click', '.nickname', (event) => {
      return this.nicknameClicked(event, $('#chatinput mark').text());
    });
  }


  abort() {
    this._requestPublicRunning = false;
    this._requestFactionRunning = false;
  }

  handleTabCompletion() {
    let el = $('#chatinput input');
    // @ts-ignore
    let curPos = el.get(0).selectionStart;
    let text = el.val() as string;
    let word = text.slice(0, curPos).replace(/.*\b([a-z0-9-_])/, '$1').toLowerCase();

    let list = $('#chat > div:visible mark');
    let newlist = list.map(function (ind, mark) { return $(mark).text(); });
    let uniqueList = uniqueArray(newlist);

    let nick = null;
    for (let i = 0; i < uniqueList.length; i++) {
      if (!(uniqueList[i] as string).toLowerCase().startsWith(word)) continue;
      if (nick && nick !== uniqueList[i]) {
        return;
      }
      nick = uniqueList[i];
    }
    if (!nick) {
      return;
    }

    let posStart = curPos - word.length;
    let newText = text.substring(0, posStart);
    let atPresent = text.substring(posStart - 1, posStart) === '@';
    newText += (atPresent ? '' : '@') + nick + ' ';
    newText += text.substring(curPos);
    el.val(newText);
  }

  //
  // clear management
  //



  genPostData(channel, storageHash, getOlderMsgs) {
    if (typeof channel !== 'string') {
      throw new Error('API changed: isFaction flag now a channel string - all, faction, alerts');
    }

    let b = clampLatLngBounds(store.map.getBounds());

    // console.log("genPostData", b)
    // set a current bounding box if none set so far
    if (!this._oldBBox) this._oldBBox = b;

    // to avoid unnecessary chat refreshes, a small difference compared to the previous bounding box
    // is not considered different
    let CHAT_BOUNDINGBOX_SAME_FACTOR = 0.1;
    // if the old and new box contain each other, after expanding by the factor, don't reset chat
    if (!(b.pad(CHAT_BOUNDINGBOX_SAME_FACTOR).contains(this._oldBBox) && this._oldBBox.pad(CHAT_BOUNDINGBOX_SAME_FACTOR).contains(b))) {
      /*  log.log('Bounding Box changed, chat will be cleared (old: '+ this._oldBBox.toBBoxString() + '; new: ' + b.toBBoxString() + ')'); */

      $('#chat > div').data('needsClearing', true);

      // need to reset these flags now because clearing will only occur
      // after the request is finished – i.e. there would be one almost
      // useless request.
      this._faction.data = {};
      this._faction.oldestTimestamp = -1;
      this._faction.newestTimestamp = -1;

      // @ts-ignore
      delete this._faction.oldestGUID;
      // @ts-ignore
      delete this._faction.newestGUID;

      this._public.data = {};
      this._public.oldestTimestamp = -1;
      this._public.newestTimestamp = -1;
      // @ts-ignore
      delete this._public.oldestGUID;
      // @ts-ignore
      delete this._public.newestGUID;

      this._alerts.data = {};
      this._alerts.oldestTimestamp = -1;
      this._alerts.newestTimestamp = -1;
      // @ts-ignore
      delete this._alerts.oldestGUID;
      // @ts-ignore
      delete this._alerts.newestGUID;

      this._oldBBox = b;
    }

    let ne = b.getNorthEast();
    let sw = b.getSouthWest();
    let data = {
      //    desiredNumItems: isFaction ? CHAT_FACTION_ITEMS : CHAT_PUBLIC_ITEMS ,
      minLatE6: Math.round(sw.lat * 1E6),
      minLngE6: Math.round(sw.lng * 1E6),
      maxLatE6: Math.round(ne.lat * 1E6),
      maxLngE6: Math.round(ne.lng * 1E6),
      minTimestampMs: -1,
      maxTimestampMs: -1,
      tab: channel,
      plextContinuationGuid: null,
      ascendingTimestampOrder: false
    }

    if (getOlderMsgs) {
      // ask for older chat when scrolling up
      data = $.extend(data, {
        maxTimestampMs: storageHash.oldestTimestamp,
        plextContinuationGuid: storageHash.oldestGUID
      });
    } else {
      // ask for newer chat
      let min = storageHash.newestTimestamp;
      // the initial request will have both timestamp values set to -1,
      // thus we receive the newest desiredNumItems. After that, we will
      // only receive messages with a timestamp greater or equal to min
      // above.
      // After resuming from idle, there might be more new messages than
      // desiredNumItems. So on the first request, we are not really up to
      // date. We will eventually catch up, as long as there are less new
      // messages than desiredNumItems per each refresh cycle.
      // A proper solution would be to query until no more new results are
      // returned. Another way would be to set desiredNumItems to a very
      // large number so we really get all new messages since the last
      // request. Setting desiredNumItems to -1 does unfortunately not
      // work.
      // Currently this edge case is not handled. Let’s see if this is a
      // problem in crowded areas.
      $.extend(data, {
        minTimestampMs: min,
        plextContinuationGuid: storageHash.newestGUID
      });

      /*  data = { ...data, minTimestampMs: min, plextContinuationGuid: storageHash.newestGUID } */
      // when requesting with an actual minimum timestamp, request oldest rather than newest first.
      // this matches the stock intel site, and ensures no gaps when continuing after an extended idle period
      if (min > -1)  $.extend(data, {ascendingTimestampOrder: true});
    }
    return data;
  }



  //
  // faction
  //


  requestFaction(getOlderMsgs: boolean, isRetry: boolean) {
    if (this._requestFactionRunning && !isRetry) return;


    if (isIdle()) return renderUpdateStatus();

    this._requestFactionRunning = true;
    $("#chatcontrols a:contains('faction')").addClass('loading');

    let d = this.genPostData('faction', this._faction, getOlderMsgs);



    postAjax('getPlexts', d)
      .then((data) => {
        this.handleFaction(data, getOlderMsgs, null);
      })
      .catch((err) => {
        console.error("error in chat", err)
        isRetry
          ? this._requestFactionRunning = false
          : this.requestFaction(getOlderMsgs, true)
      })


  }



  handleFaction(data, olderMsgs, ascendingTimestampOrder) {
    this._requestFactionRunning = false;
    $("#chatcontrols a:contains('faction')").removeClass('loading');

    if (!data || !data.result) {

      requests.failedRequestCount++;
      console.warn('faction chat error. Waiting for next auto-refresh.');
      return
    }

    if (!data.result.length && !$('#chatfaction').data('needsClearing')) {
      // no new data and current data in chat._faction.data is already rendered
      return;
    }

    $('#chatfaction').data('needsClearing', null);

    let old = this._faction.oldestGUID;
    this.writeDataToHash(data, this._faction, false, olderMsgs, ascendingTimestampOrder);
    let oldMsgsWereAdded = old !== this._faction.oldestGUID;

    runHooks('factionChatDataAvailable', { raw: data, result: data.result, processed: this._faction.data });

    this.renderFaction(oldMsgsWereAdded);
  }

  renderFaction(oldMsgsWereAdded) {
    this.renderData(this._faction.data, 'chatfaction', oldMsgsWereAdded);
  }


  //
  // all
  //

  _requestPublicRunning = false;
  requestPublic(getOlderMsgs: boolean, isRetry: boolean) {
    if (this._requestPublicRunning && !isRetry) return;

    if (isIdle()) return renderUpdateStatus();
    this._requestPublicRunning = true;
    $("#chatcontrols a:contains('all')").addClass('loading');

    let d = this.genPostData('all', this._public, getOlderMsgs);

    postAjax('getPlexts', d)
    .then(data => this.handlePublic(data, getOlderMsgs, d.ascendingTimestampOrder))
    .catch(err => isRetry
        ? this._requestPublicRunning = false
        : this.requestPublic(getOlderMsgs, true))



  }


  handlePublic(data, olderMsgs, ascendingTimestampOrder) {
    this._requestPublicRunning = false;
    $("#chatcontrols a:contains('all')").removeClass('loading');

    if (!data || !data.result) {

      requests.failedRequestCount++;
      console.warn('public chat error. Waiting for next auto-refresh.');
      return
    }

    if (!data.result.length && !$('#chatall').data('needsClearing')) {
      // no new data and current data in chat._public.data is already rendered
      return;
    }

    $('#chatall').data('needsClearing', null);

    let old = this._public.oldestGUID;
    this.writeDataToHash(data, this._public, undefined, olderMsgs, ascendingTimestampOrder);   //NOTE: isPublic passed as undefined - this is the 'all' channel, so not really public or private
    let oldMsgsWereAdded = old !== this._public.oldestGUID;


    runHooks('publicChatDataAvailable', { raw: data, result: data.result, processed: this._public.data });

    this.renderPublic(oldMsgsWereAdded);

  }

  renderPublic(oldMsgsWereAdded) {
    this.renderData(this._public.data, 'chatall', oldMsgsWereAdded);
  }


  //
  // alerts
  //

  _requestAlertsRunning = false;
  requestAlerts(getOlderMsgs, isRetry) {
    if (this._requestAlertsRunning && !isRetry) return;

    if (isIdle()) return renderUpdateStatus();
    this._requestAlertsRunning = true;
    $("#chatcontrols a:contains('alerts')").addClass('loading');

    let d = this.genPostData('alerts', this._alerts, getOlderMsgs);

    postAjax(
      'getPlexts',
      d).then((data) => {
        this.handleAlerts(data, getOlderMsgs, d.ascendingTimestampOrder);
      }).catch(err => {
        isRetry
          ? this._requestAlertsRunning = false
          : this.requestAlerts(getOlderMsgs, true)
      })


  }



  handleAlerts(data, olderMsgs, ascendingTimestampOrder: boolean) {
    this._requestAlertsRunning = false;
    $("#chatcontrols a:contains('alerts')").removeClass('loading');

    if (!data || !data.result) {

      requests.failedRequestCount++;
      return /* log.warn('alerts chat error. Waiting for next auto-refresh.'); */
    }

    if (data.result.length === 0) return;

    let old = this._alerts.oldestTimestamp;
    this.writeDataToHash(data, this._alerts, undefined, olderMsgs, ascendingTimestampOrder); //NOTE: isPublic passed as undefined - it's nether public or private!
    let oldMsgsWereAdded = old !== this._alerts.oldestTimestamp;

    // no hoot for alerts - API change planned here...
    //  runHooks('alertsChatDataAvailable', {raw: data, result: data.result, processed: chat._alerts.data});

    this.renderAlerts(oldMsgsWereAdded);
  }

  renderAlerts(oldMsgsWereAdded) {
    this.renderData(this._alerts.data, 'chatalerts', oldMsgsWereAdded);
  }



  //
  // common
  //

  nicknameClicked(event, nickname) {
    let hookData = { event: event, nickname: nickname };

    if (runHooks('nicknameClicked', hookData)) {
      this.addNickname('@' + nickname);
    }

    event.preventDefault();
    event.stopPropagation();
    return false;
  }

  writeDataToHash(newData, storageHash, isPublicChannel, isOlderMsgs, isAscendingOrder: boolean) {

    if (newData.result.length > 0) {
      //track oldest + newest timestamps/GUID
      let first = {
        guid: newData.result[0][0],
        time: newData.result[0][1]
      };
      let last = {
        guid: newData.result[newData.result.length - 1][0],
        time: newData.result[newData.result.length - 1][1]
      };
      if (isAscendingOrder) {
        let temp = first;
        first = last;
        last = temp;
      }
      if (storageHash.oldestTimestamp === -1 || storageHash.oldestTimestamp >= last.time) {
        if (isOlderMsgs || storageHash.oldestTimestamp != last.time) {
          storageHash.oldestTimestamp = last.time;
          storageHash.oldestGUID = last.guid;
        }
      }
      if (storageHash.newestTimestamp === -1 || storageHash.newestTimestamp <= first.time) {
        if (!isOlderMsgs || storageHash.newestTimestamp != first.time) {
          storageHash.newestTimestamp = first.time;
          storageHash.newestGUID = first.guid;
        }
      }
    }
    $.each(newData.result, (ind, json) => {
      // avoid duplicates
      if (json[0] in storageHash.data) return true;

      let isSecureMessage = false;
      let msgToPlayer = false;

      let time = json[1];
      let team = json[2].plext.team === 'RESISTANCE' ? TEAM_RES : TEAM_ENL;
      let auto = json[2].plext.plextType !== 'PLAYER_GENERATED';
      let systemNarrowcast = json[2].plext.plextType === 'SYSTEM_NARROWCAST';

      //remove "Your X on Y was destroyed by Z" from the faction channel
      //    if (systemNarrowcast && !isPublicChannel) return true;

      let msg = '', nick = '';
      $.each(json[2].plext.markup, (ind: number, markup) => {
        switch (markup[0]) {
          case 'SENDER': // user generated messages
            nick = markup[1].plain.slice(0, -2); // cut “: ” at end
            break;

          case 'PLAYER': // automatically generated messages
            nick = markup[1].plain;
            team = markup[1].team === 'RESISTANCE' ? TEAM_RES : TEAM_ENL;
            if (ind > 0) msg += nick; // don’t repeat nick directly
            break;

          case 'TEXT':

            msg += $('<div/>').text(markup[1].plain).html();
            break;

          case 'AT_PLAYER':

            let thisToPlayer = (markup[1].plain == ('@' + store.PLAYER.nickname));
            let spanClass = thisToPlayer ? "pl_nudge_me" : (markup[1].team + " pl_nudge_player");
            let atPlayerName = markup[1].plain.replace(/^@/, "");

            msg += (<any>$('<div/>')).html($('<span/>')
              .attr('class', spanClass)
              .attr('onclick', "window.chat.nicknameClicked(event, '" + atPlayerName + "')")
              .text(markup[1].plain)).html();
            msgToPlayer = msgToPlayer || thisToPlayer;
            break;

          case 'PORTAL':
            let lat = markup[1].latE6 / 1E6, lng = markup[1].lngE6 / 1E6;
            let perma = makePermalink([lat, lng], null);
            let js = 'window.selectPortalByLatLng(' + lat + ', ' + lng + ');return false';

            msg += '<a onclick="' + js + '"'
              + ' title="' + markup[1].address + '"'
              + ' href="' + perma + '" class="help">'
              + this.getChatPortalName(markup[1])
              + '</a>';
            break;

          case 'SECURE':
            //NOTE: we won't add the '[secure]' string here - it'll be handled below instead
            isSecureMessage = true;
            break;

          default:
            //handle unknown types by outputting the plain text version, marked with it's type
            msg += $('<div/>').text(markup[0] + ':<' + markup[1].plain + '>').html();
            break;
        }
      });


      //    //skip secure messages on the public channel
      //    if (isPublicChannel && isSecureMessage) return true;

      //    //skip public messages (e.g. @player mentions) on the secure channel
      //    if ((!isPublicChannel) && (!isSecureMessage)) return true;


      //NOTE: these two are redundant with the above two tests in place - but things have changed...
      //from the server, private channel messages are flagged with a SECURE string '[secure] ', and appear in
      //both the public and private channels
      //we don't include this '[secure]' text above, as it's redundant in the faction-only channel
      //let's add it here though if we have a secure message in the public channel, or the reverse if a non-secure in the faction one
      if (!auto && !(isPublicChannel === false) && isSecureMessage) msg = '<span style="color: #f88; background-color: #500;">[faction]</span> ' + msg;
      //and, add the reverse - a 'public' marker to messages in the private channel
      if (!auto && !(isPublicChannel === true) && (!isSecureMessage)) msg = '<span style="color: #ff6; background-color: #550">[public]</span> ' + msg;


      // format: timestamp, autogenerated, HTML message
      storageHash.data[json[0]] = [json[1], auto, this.renderMsg(msg, nick, time, team, msgToPlayer, systemNarrowcast), nick];

    });
  }

  // Override portal names that are used over and over, such as 'US Post Office'
  getChatPortalName(markup) {
    let name = markup.name;
    if (name === 'US Post Office') {
      let address = markup.address.split(',');
      name = 'USPS: ' + address[0];
    }
    return name;
  }

  // renders data from the data-hash to the element defined by the given
  // ID. Set 3rd argument to true if it is likely that old data has been
  // added. Latter is only required for scrolling.
  renderData(data, element, likelyWereOldMsgs) {
    console.log("render data", data)
    let elm = $('#' + element);
    if (elm.is(':hidden')) return;

    // discard guids and sort old to new
    //TODO? stable sort, to preserve server message ordering? or sort by GUID if timestamps equal?
    let vals = $.map(data, function (v, k) { return [v]; });
    vals = vals.sort(function (a, b) { return a[0] - b[0]; });

    // render to string with date separators inserted
    let msgs = '';
    let prevTime = null;
    $.each(vals, (ind, msg) =>  {
      let nextTime = new Date(msg[0]).toLocaleDateString();
      if (prevTime && prevTime !== nextTime)
        msgs += this.renderDivider(nextTime);
      msgs += msg[2];
      prevTime = nextTime;
    });

    let scrollBefore = scrollBottom(elm);
    elm.html('<table>' + msgs + '</table>');
    this.keepScrollPosition(elm, scrollBefore, likelyWereOldMsgs);
  }


  renderDivider(text) {
    let d = ' ──────────────────────────────────────────────────────────────────────────';
    return '<tr><td colspan="3" style="padding-top:3px"><summary>─ ' + text + d + '</summary></td></tr>';
  }


  renderMsg(msg, nick, time, team, msgToPlayer, systemNarrowcast) {
    let ta = unixTimeToHHmm(time);
    let tb = unixTimeToDateTimeString(time, true);
    //add <small> tags around the milliseconds
    tb = (tb.slice(0, 19) + '<small class="milliseconds">' + tb.slice(19) + '</small>').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // help cursor via “#chat time”
    let t = '<time title="' + tb + '" data-timestamp="' + time + '">' + ta + '</time>';
    if (msgToPlayer) {
      t = '<div class="pl_nudge_date">' + t + '</div><div class="pl_nudge_pointy_spacer"></div>';
    }
    if (systemNarrowcast) {
      msg = '<div class="system_narrowcast">' + msg + '</div>';
    }
    let color = COLORS[team];

    if (nick === store.PLAYER.nickname) color = '#fd6';    //highlight things said/done by the player in a unique colour (similar to @player mentions from others in the chat text itself)
    let s = 'style="cursor:pointer; color:' + color + '"';
    let i = ['<span class="invisep">&lt;</span>', '<span class="invisep">&gt;</span>'];
    return '<tr><td>' + t + '</td><td>' + i[0] + '<mark class="nickname" ' + s + '>' + nick + '</mark>' + i[1] + '</td><td>' + msg + '</td></tr>';
  }

  addNickname(nick) {
    var c = document.getElementById("chattext") as HTMLInputElement;
    c.value = [c.value.trim(), nick].join(" ").trim() + " ";
    c.focus()
  }



  getActive() {
    return $('#chatcontrols .active').text();
  }

  tabToChannel(tab) {
    if (tab == 'faction') return 'faction';
    if (tab == 'alerts') return 'alerts';
    return 'all';
  };



  toggle() {


    let c = $('#chat, #chatcontrols');
    if (c.hasClass('expand')) {
      c.removeClass('expand');
      let div = $('#chat > div:visible');
      div.data('ignoreNextScroll', true);
      div.scrollTop(99999999); // scroll to bottom
      $('.leaflet-control').removeClass('chat-expand');
    } else {
      c.addClass('expand');
      $('.leaflet-control').addClass('chat-expand');
      this.needMoreMessages();
    }
  };




  // called by plugins (or other things?) that need to monitor COMM data streams when the user is not viewing them
  // instance: a unique string identifying the plugin requesting background COMM
  // channel: either 'all', 'faction' or (soon) 'alerts' - others possible in the future
  // flag: true for data wanted, false for not wanted
  backgroundChannelData(instance, channel, flag) {
    //first, store the state for this instance
    if (!this.backgroundInstanceChannel) this.backgroundInstanceChannel = {};
    if (!this.backgroundInstanceChannel[instance]) this.backgroundInstanceChannel[instance] = {};
    this.backgroundInstanceChannel[instance][channel] = flag;

    //now, to simplify the request code, merge the flags for all instances into one
    // 1. clear existing overall flags
    this.backgroundChannels = {};
    // 2. for each instance monitoring COMM...
    $.each(this.backgroundInstanceChannel, (instance, channels) => {
      // 3. and for each channel monitored by this instance...
      $.each(this.backgroundInstanceChannel[instance], (channel, flag) => {
        // 4. if it's monitored, set the channel flag
        if (flag) this.backgroundChannels[channel] = true;
      });
    });

  }


  request() {
    let channel: string = this.tabToChannel(this.getActive());
/*     console.log("chat request, active channel", channel) */
    if (channel == 'faction' || (this.backgroundChannels && this.backgroundChannels['faction'])) {
      this.requestFaction(false, false);
    }
    if (channel == 'all' || (this.backgroundChannels && this.backgroundChannels['all'])) {
      this.requestPublic(false, false);
    }
    if (channel == 'alerts' || (this.backgroundChannels && this.backgroundChannels['alerts'])) {
      this.requestAlerts(false, false);
    }
  }


  // checks if there are enough messages in the selected chat tab and
  // loads more if not.
  needMoreMessages() {
    let activeTab = this.getActive();
    if (activeTab === 'debug') return;

    let activeChat = $('#chat > :visible');
    if (activeChat.length === 0) return;

    let hasScrollbar = scrollBottom(activeChat) !== 0 || activeChat.scrollTop() !== 0;
    let nearTop = activeChat.scrollTop() <= CHAT_REQUEST_SCROLL_TOP;
    if (hasScrollbar && !nearTop) return;

    if (activeTab === 'faction')
      this.requestFaction(true, false);
    else
      this.requestPublic(true, false);
  }


  chooseTab(tab) {
    if (tab != 'all' && tab != 'faction' && tab != 'alerts') {
      console.warn('chat tab "' + tab + '" requested - but only "all", "faction" and "alerts" are valid - assuming "all" wanted');
      tab = 'all';
    }
    console.log("choosing tab", tab)
    let oldTab = this.getActive();

    window.localStorage['iitc-chat-tab'] = tab;

    let mark = $('#chatinput mark');
    let input = $('#chatinput input');

    $('#chatcontrols .active').removeClass('active');
    $("#chatcontrols a:contains('" + tab + "')").addClass('active');

    if (tab != oldTab) startRefreshTimeout(0.1 * 1000); //only chat uses the refresh timer stuff, so a perfect way of forcing an early refresh after a tab change

    $('#chat > div').hide();

    let elm = $('#chat' + tab);
    elm.show();

    switch (tab) {
      case 'faction':
        input.css('color', '');
        mark.css('color', '');
        mark.text('tell faction:');

        this.renderFaction(false);
        break;

      case 'all':
        input.css('cssText', 'color: #f66 !important');
        mark.css('cssText', 'color: #f66 !important');
        mark.text('broadcast:');

        this.renderPublic(false);
        break;

      case 'alerts':
        mark.css('cssText', 'color: #bbb !important');
        input.css('cssText', 'color: #bbb !important');
        mark.text('tell Jarvis:');

        this.renderAlerts(false);
        break;

      default:
        throw new Error('chat.chooser was asked to handle unknown button: ');
    }

    if (elm.data('needsScrollTop')) {
      elm.data('ignoreNextScroll', true);
      elm.scrollTop(elm.data('needsScrollTop'));
      elm.data('needsScrollTop', null);
    }
  }

  show(name) {
    isSmartphone()
      ? $('#updatestatus').hide()
      : $('#updatestatus').show();
    $('#chat, #chatinput').show();

    this.chooseTab(name);
  }

  chooser(event: any) {
    let t = $(event.target);
    let tab = t.text();
    this.chooseTab(tab);
  }

  // contains the logic to keep the correct scroll position.
  keepScrollPosition(box, scrollBefore, isOldMsgs) {
    // If scrolled down completely, keep it that way so new messages can
    // be seen easily. If scrolled up, only need to fix scroll position
    // when old messages are added. New messages added at the bottom don’t
    // change the view and enabling this would make the chat scroll down
    // for every added message, even if the user wants to read old stuff.

    if (box.is(':hidden') && !isOldMsgs) {
      box.data('needsScrollTop', 99999999);
      return;
    }

    if (scrollBefore === 0 || isOldMsgs) {
      box.data('ignoreNextScroll', true);
      box.scrollTop(box.scrollTop() + (scrollBottom(box) - scrollBefore));
    }
  }




  //
  // setup
  //




  setupTime() {
    let inputTime = $('#chatinput time');
    let updateTime = () => {
      if (isIdle()) return;
      let d = new Date();
      let h = d.getHours() + ''; if (h.length === 1) h = '0' + h;
      let m = d.getMinutes() + ''; if (m.length === 1) m = '0' + m;
      inputTime.text(h + ':' + m);
      // update ON the minute (1ms after)
      setTimeout(updateTime, (60 - d.getSeconds()) * 1000 + 1);
    };
    updateTime();
    addResumeFunction(updateTime);
  }


  //
  // posting
  //


  setupPosting() {

    if (!isSmartphone()) {

      $('#chatinput input').keydown((event: any) => {
        try {
          let kc = (event.keyCode ? event.keyCode : event.which);
          if (kc === 13) { // enter

            this.postMsg();
            event.preventDefault();
          } else if (kc === 9) { // tab
            event.preventDefault();

            this.handleTabCompletion();
          }
        } catch (e) {
          console.error(e);
          //if (e.stack) { console.error(e.stack); }
        }
      });
    }



    $('#chatinput').on('submit', (event) => {
      event.preventDefault();

      this.postMsg();
    });
  }


  postMsg() {
    let c = this.getActive();
    if (c == 'alerts')
      return alert("Jarvis: A strange game. The only winning move is not to play. How about a nice game of chess?\n(You can't chat to the 'alerts' channel!)");

    let msg = $.trim($('#chatinput input').val() as string);
    if (!msg || msg === '') return;

    // Potentially harmful code, removes as unnesseccary
    /* if (c === 'debug') {
      let result;
      try {
        result = eval(msg);
      } catch (e) {
        if (e.stack) { }
        throw e;
      }
      if (result !== undefined) {
      
      }
      return result;
    } */


    let latlng = store.map.getCenter();

    let data = {
      message: msg,
      latE6: Math.round(latlng.lat * 1E6),
      lngE6: Math.round(latlng.lng * 1E6),
      tab: c
    };

    let errMsg = 'Your message could not be delivered. You can copy&' +
      'paste it here and try again if you want:\n\n' + msg;


    postAjax('sendPlext', data).then(data => startRefreshTimeout(0.1 * 1000)).catch(err => alert(errMsg))


    $('#chatinput input').val('');
  }

}