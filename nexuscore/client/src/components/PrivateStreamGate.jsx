import Icon from './Icon';

export default function PrivateStreamGate({ watchState, viewerQueue, onStopWatching }) {
  const queue = watchState?.in_queue
    ? watchState
    : viewerQueue
      ? {
          in_queue: true,
          queue_position: viewerQueue.position,
          estimated_wait_mins: viewerQueue.estimated_wait_mins,
          status: viewerQueue.status,
        }
      : null;
  const position = queue?.queue_position ?? queue?.position;
  const waitMins = queue?.estimated_wait_mins;

  return (
    <div className="cloud-private-stream-gate">
      <Icon name="lock" size={36} />
      <h3 className="font-display">This stream is private</h3>
      <p>The player has not allowed spectators. Gameplay is hidden.</p>
      {queue?.in_queue ? (
        <div className="cloud-private-queue-box">
          {queue.status === 'ready' || position === 0 ? (
            <>
              <p className="font-display cloud-private-queue-ready">Your slot is ready</p>
              <p>Connect from the queue section below to start your own session.</p>
            </>
          ) : (
            <>
              <p className="font-display cloud-private-queue-pos">#{position || '?'}</p>
              <p>Your queue position</p>
              {waitMins != null && (
                <p className="cloud-private-queue-wait">Estimated wait: ~{waitMins} minutes</p>
              )}
            </>
          )}
        </div>
      ) : (
        <p className="cloud-private-queue-hint">
          Join the free-tier queue from any cloud game to play when a slot opens.
        </p>
      )}
      {onStopWatching && (
        <button type="button" className="btn btn-ghost" onClick={onStopWatching}>
          Stop watching
        </button>
      )}
    </div>
  );
}
