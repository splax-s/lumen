import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { BottomSheet } from '../index';

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open kettle</button>
      <button>Elsewhere</button>
      <BottomSheet
        open={open}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        title="Where does boiling water go?"
        closeLabel="Close"
      >
        <button>Start lesson</button>
      </BottomSheet>
    </>
  );
}

describe('BottomSheet', () => {
  it('is not in the page until opened', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens as a dialog named by its title and takes focus', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open kettle' }));
    const dialog = screen.getByRole('dialog', { name: 'Where does boiling water go?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('keeps Tab inside the sheet in both directions', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open kettle' }));
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await userEvent.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('closes on Escape and gives focus back to what opened it', async () => {
    let closed = 0;
    render(<Harness onClose={() => closed++} />);
    const opener = screen.getByRole('button', { name: 'Open kettle' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(closed).toBe(1);
    expect(opener).toHaveFocus();
  });

  it('closes with the close button and when the backdrop is clicked', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open kettle' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Open kettle' }));
    await userEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not close when the sheet itself is clicked', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open kettle' }));
    await userEvent.click(screen.getByRole('heading', { name: 'Where does boiling water go?' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
