import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalog, type CatalogObject } from '@lumen/lessons';
import { OBJECT_ART, Town, anchorOf, objectStates } from './index';

function show(
  done: string[] = [],
  threadId: string | null = null,
  onOpen: (o: CatalogObject) => void = () => {},
) {
  return render(
    <Town
      objects={catalog.objects}
      places={catalog.places}
      states={objectStates(catalog.objects, done)}
      thread={catalog.threads.find((t) => t.id === threadId) ?? null}
      nextLabel={done.length ? 'Next up' : 'Start here'}
      describe={(object, state) => `${object.name}, ${state}`}
      label="Your town"
      onOpen={onOpen}
    />,
  );
}

describe('Town', () => {
  it('draws every object in the catalog, each with its own art and place', () => {
    show();
    expect(screen.getAllByRole('button')).toHaveLength(21);
    for (const object of catalog.objects) {
      expect(OBJECT_ART[object.id], `art for ${object.id}`).toBeDefined();
      const a = anchorOf(object.id);
      expect(a.x).toBeGreaterThan(0);
      expect(a.x).toBeLessThan(1680);
    }
  });

  it('keeps objects from sitting on top of each other', () => {
    const anchors = catalog.objects.map((o) => ({ id: o.id, ...anchorOf(o.id) }));
    for (const a of anchors) {
      for (const b of anchors) {
        if (a.id >= b.id) continue;
        const gap = Math.hypot(a.x - b.x, a.y - b.y);
        expect(gap, `${a.id} and ${b.id}`).toBeGreaterThan(70);
      }
    }
  });

  it('describes each object with its state', () => {
    show(['chem.ice-floats']);
    expect(screen.getByRole('button', { name: 'Glass of ice water, done' })).toHaveAttribute(
      'data-state',
      'done',
    );
    expect(screen.getByRole('button', { name: 'Kettle, next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Radio dish, soon' })).toBeInTheDocument();
  });

  it('tags the next object', () => {
    const { container } = show();
    expect(container.querySelector('[data-object="glass"]')?.textContent).toContain('Start here');
    expect(container.querySelector('[data-object="swing"]')?.textContent).not.toContain(
      'Start here',
    );
  });

  it('opens an object with a click, Enter or Space', async () => {
    const opened: string[] = [];
    show([], null, (o) => opened.push(o.id));
    await userEvent.click(screen.getByRole('button', { name: /^Kettle/ }));
    screen.getByRole('button', { name: /^Swing/ }).focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(opened).toEqual(['kettle', 'swing', 'swing']);
  });

  it('draws a thread through its objects and marks the rest as unlinked', () => {
    const { container } = show([], 'particles');
    const linked = [...container.querySelectorAll('[data-object]')].filter((el) =>
      /linked/.test(el.getAttribute('class') ?? ''),
    );
    expect(linked.map((el) => el.getAttribute('data-object')).sort()).toEqual([
      'baking-soda',
      'gate',
      'glass',
      'kettle',
    ]);
    expect(container.querySelector('svg')?.getAttribute('class')).toMatch(/dimmed/);
    expect(container.querySelectorAll('path[class*="thread"]')).toHaveLength(1);
  });

  it('shows no thread path when none is chosen', () => {
    const { container } = show();
    expect(container.querySelectorAll('path[class*="thread"]')).toHaveLength(0);
  });

  it('sits in a frame that scrolls sideways rather than shrinking the scene', () => {
    const { container } = show();
    expect(container.querySelector('[data-scroll-x]')).not.toBeNull();
  });
});
