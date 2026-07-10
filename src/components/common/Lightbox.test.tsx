import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Lightbox } from './Lightbox';

describe('Lightbox', () => {
  it('renders an image when given src/alt', () => {
    render(<Lightbox src="/foo.png" alt="A foo" onClose={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'A foo' })).toHaveAttribute('src', '/foo.png');
  });

  it('renders children instead of an image when given', () => {
    render(
      <Lightbox onClose={vi.fn()}>
        <div data-testid="custom-content">Custom card content</div>
      </Lightbox>,
    );
    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders an optional caption below the content', () => {
    render(<Lightbox src="/foo.png" alt="A foo" caption="Foo Caption" onClose={vi.fn()} />);
    expect(screen.getByText('Foo Caption')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Lightbox src="/foo.png" alt="A foo" onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Close image' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Lightbox src="/foo.png" alt="A foo" onClose={onClose} />);

    await user.click(screen.getByRole('presentation'));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does NOT call onClose when the content itself is clicked (does not bubble to the backdrop)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Lightbox src="/foo.png" alt="A foo" onClose={onClose} />);

    await user.click(screen.getByRole('img', { name: 'A foo' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Lightbox src="/foo.png" alt="A foo" onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });
});