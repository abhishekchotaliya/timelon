type Props = {
  running: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSkip: () => void;
};

export function Controls({ running, onStart, onPause, onReset, onSkip }: Props) {
  return (
    <div className="controls">
      <button className="btn-secondary" onClick={onReset} title="Reset">
        Reset
      </button>
      <button
        className="btn-primary"
        onClick={running ? onPause : onStart}
        title={running ? "Pause" : "Start"}
      >
        {running ? "Pause" : "Start"}
      </button>
      <button className="btn-secondary" onClick={onSkip} title="Skip to next phase">
        Skip
      </button>
    </div>
  );
}
