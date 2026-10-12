import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { Depth } from '@lumen/engine';
import { Button, DepthSwitch, Lumi, LumiStrip, ProgressDots } from '../index';

describe('Lumi', () => {
  it.each([
    ['happy', 'Lumi, happy'],
    ['thinking', 'Lumi, thinking'],
    ['wow', 'Lumi, amazed'],
    ['proud', 'Lumi, proud'],
  ] as const)('draws the %s mood with an accessible name', (mood, name) => {
    render(<Lumi mood={mood} />);
    expect(screen.getByRole('img', { name })).toBeInTheDocument();
  });

  it('draws a different face for each mood', () => {
    const faces = (['happy', 'thinking', 'wow', 'proud'] as const).map((mood) => {
      const { container, unmount } = render(<Lumi mood={mood} />);
      const html = container.innerHTML;
      unmount();
      return html;
    });
    expect(new Set(faces).size).toBe(4);
  });

  it('can be decorative', () => {
    const { container } = render(<Lumi mood="happy" decorative />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

function Switch({ onChange }: { onChange?: (d: Depth) => void }) {
  const [depth, setDepth] = useState<Depth>('play');
  return (
    <DepthSwitch
      value={depth}
      onChange={(d) => {
        setDepth(d);
        onChange?.(d);
      }}
      labels={{ group: 'Depth', play: 'Play', explain: 'Explain', deep: 'Deep' }}
    />
  );
}

describe('DepthSwitch', () => {
  it('is a radio group with the current depth checked', () => {
    render(<Switch />);
    expect(screen.getByRole('radiogroup', { name: 'Depth' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Play' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Deep' })).not.toBeChecked();
  });

  it('changes depth on click', async () => {
    const seen: Depth[] = [];
    render(<Switch onChange={(d) => seen.push(d)} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Deep' }));
    expect(seen).toEqual(['deep']);
    expect(screen.getByRole('radio', { name: 'Deep' })).toBeChecked();
  });

  it('moves with the arrow keys and wraps around', async () => {
    const seen: Depth[] = [];
    render(<Switch onChange={(d) => seen.push(d)} />);
    await userEvent.tab();
    expect(screen.getByRole('radio', { name: 'Play' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowLeft}');
    expect(seen).toEqual(['explain', 'deep', 'play', 'deep']);
    expect(screen.getByRole('radio', { name: 'Deep' })).toHaveFocus();
  });

  it('keeps only the checked option in the tab order', () => {
    render(<Switch />);
    expect(screen.getByRole('radio', { name: 'Play' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Explain' })).toHaveAttribute('tabindex', '-1');
  });
});

describe('Button', () => {
  it('is a real button that defaults to type=button', () => {
    render(<Button>Continue</Button>);
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveAttribute('type', 'button');
  });

  it('does not fire when disabled', async () => {
    let clicks = 0;
    render(
      <Button disabled onClick={() => clicks++}>
        Continue
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(clicks).toBe(0);
  });

  it('marks its variant for styling', () => {
    render(<Button variant="secondary">Back</Button>);
    expect(screen.getByRole('button').className).toMatch(/secondary/);
  });
});

describe('LumiStrip', () => {
  it('announces what Lumi says politely and offers read-aloud when available', async () => {
    let spoken = 0;
    render(<LumiStrip mood="wow" text="Frozen!" name="Lumi" speakLabel="Read aloud" onSpeak={() => spoken++} />);
    expect(screen.getByText('Frozen!').closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
    await userEvent.click(screen.getByRole('button', { name: 'Read aloud' }));
    expect(spoken).toBe(1);
  });

  it('has no read-aloud button when speech is unavailable', () => {
    render(<LumiStrip mood="happy" text="Hi" name="Lumi" speakLabel="Read aloud" />);
    expect(screen.queryByRole('button', { name: 'Read aloud' })).toBeNull();
  });
});

describe('ProgressDots', () => {
  it('describes progress in words', () => {
    render(<ProgressDots current={3} total={7} label="Step 4 of 7" />);
    expect(screen.getByRole('img', { name: 'Step 4 of 7' })).toBeInTheDocument();
  });

  it('marks done, current and upcoming steps', () => {
    const { container } = render(<ProgressDots current={1} total={3} label="Step 2 of 3" />);
    const states = [...container.querySelectorAll('i')].map((i) => i.getAttribute('data-state'));
    expect(states).toEqual(['done', 'current', 'upcoming']);
  });
});
