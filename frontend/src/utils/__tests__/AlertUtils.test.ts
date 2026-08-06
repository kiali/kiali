import { NotificationCenterActions } from '../../actions/NotificationCenterActions';
import { store } from '../../store/ConfigStore';
import { MessageType } from '../../types/NotificationCenter';
import { addWarning } from '../AlertUtils';

describe('AlertUtils', () => {
  afterEach(() => {
    rstest.restoreAllMocks();
  });

  it('does not dispatch a duplicate warning when showOnce is enabled', () => {
    rstest.spyOn(store, 'getState').mockReturnValue({
      notificationCenter: {
        groups: [
          {
            id: MessageType.WARNING,
            messages: [{ content: 'Tracing configuration warning' }]
          }
        ]
      }
    } as any);
    const dispatch = rstest.spyOn(store, 'dispatch');

    addWarning('Tracing configuration warning', '', true, true);

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('dispatches when showOnce is disabled', () => {
    const dispatch = rstest.spyOn(store, 'dispatch');

    addWarning('Repeated warning');

    expect(dispatch).toHaveBeenCalledWith(
      NotificationCenterActions.addMessage(
        'Repeated warning',
        '',
        MessageType.WARNING,
        MessageType.WARNING,
        true
      )
    );
  });

  it('dispatches a show-once warning when no matching warning exists', () => {
    rstest.spyOn(store, 'getState').mockReturnValue({
      notificationCenter: {
        groups: [
          {
            id: MessageType.INFO,
            messages: [{ content: 'Tracing configuration warning' }]
          }
        ]
      }
    } as any);
    const dispatch = rstest.spyOn(store, 'dispatch');

    addWarning('Tracing configuration warning', '', true, true);

    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
