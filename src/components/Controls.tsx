import { Button } from "./ui/button";

type Props = {
  running: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSkip: () => void;
};

export function Controls({ running, onStart, onPause, onReset, onSkip }: Props) {
  return (
    <div className="flex items-center gap-2.5">
      <Button variant="secondary" onClick={onReset} title="Reset">
        Reset
      </Button>
      <Button onClick={running ? onPause : onStart} title={running ? "Pause" : "Start"}>
        {running ? "Pause" : "Start"}
      </Button>
      <Button variant="secondary" onClick={onSkip} title="Skip to next phase">
        Skip
      </Button>
    </div>
  );
}
