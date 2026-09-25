/* ============================================================================
   Sentry · Notifications                                     (owner: Shaheen)
   Alerts built from the summary. Tapping one marks it read and opens the
   screen that deals with it.
   ============================================================================ */

import { pluralize } from '../../shared/dates';
import { css, rowStyle, type ViewProps } from '../../app/styles';
import { CLOSED_OVERLAYS } from '../../app/ui-state';

// ── START: Notifications screen ────────────────────────────────────────────
export var NOTIFICATION_TONES = {
  red: { background: '#FDE7E5', dot: '#F2544B' },
  purple: { background: '#F3EDFF', dot: '#8552FF' },
  green: { background: '#EAF7E6', dot: '#4E8A41' }
};

export function notificationsScreen(app) {
  var summary = app.summary;
  var profile = app.profile;
  var alerts = profile.alerts || {};
  var list = summary.notifications;
  var alertTypes = ['overspend', 'emi', 'fx', 'deadlines'];

  function markRead(ids) {
    var read = Object.assign({}, profile.readNotifications || {});
    ids.forEach(function (id) { read[id] = true; });
    app.saveProfile({ readNotifications: read });
  }

  return {
    notifications: list.map(function (item, index) {
      var tone = NOTIFICATION_TONES[item.tone];
      var unread = !(profile.readNotifications || {})[item.id];
      return {
        title: item.title,
        body: item.body,
        time: item.tone === 'red' ? 'Needs action' : 'Heads-up',
        actionText: item.action,
        unread: unread,
        rowStyle: rowStyle(index, list.length, 'animation:fadeUp .32s ease ' + (index * 0.05).toFixed(2) + 's both;display:flex;align-items:flex-start;gap:12px;padding:16px 0;cursor:pointer'),
        iconStyle: 'width:36px;height:36px;border-radius:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-top:2px;background:' + tone.background,
        dotStyle: 'width:12px;height:12px;border-radius:6px;background:' + tone.dot,
        titleStyle: 'font-size:14px;font-weight:' + (unread ? '800' : '600') + ';color:' + (unread ? '#0B0620' : '#4A4266'),
        open: function () {
          markRead([item.id]);
          var destination = Object.assign({ screen: item.screen }, CLOSED_OVERLAYS);
          if (item.categoryIndex !== undefined) Object.assign(destination, { forecastCategory: item.categoryIndex, showInsight: true });
          if (item.screen === 'budget' && item.id.indexOf('review-') === 0) Object.assign(destination, { expenseFilter: 'review', categoryGroup: 'all', showAllExpenses: true });
          app.update(destination);
        }
      };
    }),
    notifsAllClear: list.length === 0,
    notifHeading: summary.unreadCount ? pluralize(summary.unreadCount, 'unread alert') : 'All caught up',
    markAllRead: function () {
      markRead(list.map(function (item) { return item.id; }));
      app.toast('All notifications marked as read');
    },
    alertsOnCount: alertTypes.filter(function (type) { return alerts[type]; }).length,
    alertTypes: alertTypes.length
  };
}
// ── END: Notifications screen ──────────────────────────────────────────────


// ── START: View ──────────────────────────────────────────────────────────────────
export function NotificationsView({ v }: ViewProps) {
  return (
    <div style={{ animation: 'scIn .34s cubic-bezier(.22,.85,.3,1) both' }} data-screen-label="Notifications">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '64px 18px 14px' }}>
        <div onClick={v.goHome} style={{ width: '40px', height: '40px', borderRadius: '20px', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(5,0,17,0.08)', cursor: 'pointer' }}>
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="#0B0620" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={{ fontSize: '18px', fontWeight: '700', color: '#0B0620', letterSpacing: '-0.01em' }}>Notifications</span>
        <div style={{ width: '40px' }} />
      </div>
      <div style={{ padding: '10px 18px 132px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>{v.notifHeading}</span>
          {v.hasUnread ? (
            <span onClick={v.markAllRead} style={{ fontSize: '12px', fontWeight: '700', color: '#8552FF', cursor: 'pointer' }}>Mark all read</span>
          ) : null}
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '8px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          {(v.notifications || []).map((item: any, i: number) => (
            <div key={i} onClick={item.open} style={css(item.rowStyle)}>
              <span style={css(item.iconStyle)}>
                <span style={css(item.dotStyle)} />
              </span>
              <div style={{ flex: '1', minWidth: '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={css(item.titleStyle)}>{item.title}</span>
                  {item.unread ? (
                    <span style={{ width: '7px', height: '7px', borderRadius: '4px', background: '#8552FF', flexShrink: '0' }} />
                  ) : null}
                </div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#7C7893', marginTop: '3px', textWrap: 'pretty' }}>{item.body}</div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#9A95AE', marginTop: '5px' }}>{item.time} · {item.actionText}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: '0' }}>
                <path d="M8 5l5 5-5 5" stroke="#B9B4CC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ))}
        </div>
        {v.notifsAllClear ? (
          <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '26px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '44px', height: '44px', borderRadius: '16px', background: '#EAF7E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
                <path d="M4.5 10.5l3.5 3.5 7.5-7.5" stroke="#4E8A41" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0B0620' }}>Nothing needs you right now</div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893', textAlign: 'center', textWrap: 'pretty' }}>
              Budgets, EMIs and your LRS position are all inside their limits.
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Delivery</span>
          <span onClick={v.goSettings} style={{ fontSize: '12px', fontWeight: '700', color: '#8552FF', cursor: 'pointer' }}>Manage</span>
        </div>
        <div onClick={v.goSettings} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: '#FFFFFF', borderRadius: '20px', padding: '16px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)', cursor: 'pointer' }}>
          <div style={{ minWidth: '0' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>{v.alertsOnCount} of {v.alertTypes} alert types on</div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '2px' }}>Warning at {v.thresholdLabel}</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M8 5l5 5-5 5" stroke="#B9B4CC" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
// ── END: View ────────────────────────────────────────────────────────────────────
