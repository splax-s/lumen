import { useMemo, useRef, useState } from 'react';
import {
  resolveText,
  type Control,
  type InteractiveStep,
  type LessonRuntime,
  type RuntimeState,
  type SimValue,
  type ThenStage,
} from '@lumen/engine';
import { Button } from '@lumen/design';
import { ItemIcon } from './art';
import { SimCanvas, type SimHandle } from './SimCanvas';
import styles from './lesson.module.css';

type Props = {
  stage: InteractiveStep | ThenStage;
  runtime: LessonRuntime;
  state: RuntimeState;
  label: string;
};

function startValues(controls: Control[] | undefined): Record<string, SimValue> {
  const values: Record<string, SimValue> = {};
  for (const control of controls ?? []) {
    if (control.type === 'slider' || control.type === 'choice')
      values[control.param] = control.start;
  }
  return values;
}

function format(value: number, decimals: number | undefined, unit: string | undefined): string {
  const text = (decimals !== undefined ? value.toFixed(decimals) : String(value)).replace('-', '−');
  return unit ? `${text} ${unit}` : text;
}

/** A simulation with whatever the lesson gives the learner to touch: a tray, sliders, buttons, a toggle. */
export function InteractiveStage({ stage, runtime, state, label }: Props) {
  const sim = useRef<SimHandle>(null);
  const initial = useMemo(() => startValues(stage.controls), [stage]);
  const [values, setValues] = useState(initial);
  const [used, setUsed] = useState<string[]>([]);
  const depth = state.depth;
  const trayParam = stage.tray_param ?? 'drop';

  const set = (param: string, value: SimValue) => {
    setValues((current) => ({ ...current, [param]: value }));
    sim.current?.setParam(param, value);
  };

  return (
    <div className={styles.interactive}>
      <SimCanvas
        ref={sim}
        spec={stage.sim}
        bus={runtime.bus}
        depth={depth}
        label={label}
        initialParams={initial}
        onState={(simState) => runtime.setSimState(simState)}
        className={styles.sim}
      />

      {stage.goal ? <p className={styles.goal}>{resolveText(stage.goal, depth)}</p> : null}

      {stage.tray ? (
        <div className={styles.tray}>
          {stage.tray.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.trayItem}
              disabled={used.includes(item.id)}
              onClick={() => {
                setUsed((current) => [...current, item.id]);
                sim.current?.setParam(trayParam, item.id);
              }}
            >
              <ItemIcon id={item.icon} size={34} />
              {resolveText(item.label, depth)}
            </button>
          ))}
        </div>
      ) : null}

      {stage.controls?.map((control) => {
        if (control.type === 'slider') {
          const id = `control-${control.param}`;
          const value = Number(values[control.param] ?? control.start);
          return (
            <div key={control.param} className={styles.slider}>
              <label htmlFor={id}>{resolveText(control.label, depth)}</label>
              <input
                id={id}
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={value}
                aria-valuetext={format(value, control.decimals, control.unit)}
                onChange={(event) => set(control.param, Number(event.target.value))}
              />
              <output htmlFor={id}>{format(value, control.decimals, control.unit)}</output>
            </div>
          );
        }
        if (control.type === 'choice') {
          return (
            <fieldset key={control.param} className={styles.choiceControl}>
              <legend>{resolveText(control.label, depth)}</legend>
              {control.options.map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  aria-pressed={values[control.param] === option.value}
                  className={styles.option}
                  onClick={() => set(control.param, option.value)}
                >
                  {resolveText(option.label, depth)}
                </button>
              ))}
            </fieldset>
          );
        }
        return (
          <div key={`${control.param}-${String(control.value)}`} className={styles.tray}>
            <Button
              variant="secondary"
              onClick={() => sim.current?.setParam(control.param, control.value)}
            >
              {resolveText(control.label, depth)}
            </Button>
          </div>
        );
      })}

      {stage.toggle ? (
        <div className={styles.tray}>
          <Button
            variant="secondary"
            aria-pressed={state.toggleOn}
            onClick={() => {
              const toggle = stage.toggle!;
              const on = !state.toggleOn;
              sim.current?.setParam(toggle.param, on ? toggle.on.value : toggle.off.value);
              runtime.setToggle(on);
            }}
          >
            {resolveText(state.toggleOn ? stage.toggle.off.label : stage.toggle.on.label, depth)}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
