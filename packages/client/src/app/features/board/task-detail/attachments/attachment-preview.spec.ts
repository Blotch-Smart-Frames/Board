import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AttachmentPreview } from './attachment-preview';
import type { Attachment } from '../../../../shared/types/board';

function fakeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'a1',
    fileName: 'photo.png',
    fileSize: 2048,
    fileType: 'image/png',
    storagePath: 'boards/board-1/tasks/task-1/attachments/a1.png',
    downloadUrl: 'https://example.com/photo.png',
    uploadedAt: Date.now(),
    ...overrides,
  };
}

function fakeVideoAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return fakeAttachment({
    fileName: 'clip.mp4',
    fileType: 'video/mp4',
    storagePath: 'boards/board-1/tasks/task-1/attachments/a1.mp4',
    downloadUrl: 'https://example.com/clip.mp4',
    ...overrides,
  });
}

describe('AttachmentPreview', () => {
  it('renders an image preview using the download URL when the file type is an image', async () => {
    await render(AttachmentPreview, { inputs: { attachment: fakeAttachment() } });

    const img = screen.getByRole('img', { name: /photo\.png/i }) as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/photo.png');
  });

  it('renders a video thumbnail rather than an image for a video file type', async () => {
    const { container } = await render(AttachmentPreview, {
      inputs: { attachment: fakeVideoAttachment() },
    });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    const video = container.querySelector('video');
    expect(video).toHaveAttribute('src', 'https://example.com/clip.mp4');
  });

  it('opens a modal showing the full image when the preview is clicked', async () => {
    const user = userEvent.setup();
    await render(AttachmentPreview, { inputs: { attachment: fakeAttachment() } });

    await user.click(screen.getByRole('button', { name: /view photo\.png/i }));

    const dialog = await screen.findByRole('dialog');
    const fullImage = within(dialog).getByRole('img', { name: /photo\.png/i }) as HTMLImageElement;
    expect(fullImage).toHaveAttribute('src', 'https://example.com/photo.png');
  });

  it('opens a modal with a playable video when a video preview is clicked', async () => {
    const user = userEvent.setup();
    await render(AttachmentPreview, { inputs: { attachment: fakeVideoAttachment() } });

    await user.click(screen.getByRole('button', { name: /view clip\.mp4/i }));

    const dialog = await screen.findByRole('dialog');
    const video = dialog.querySelector('video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', 'https://example.com/clip.mp4');
    expect(video).toHaveAttribute('controls');
  });

  it('emits deleted with the attachment id when the delete button is clicked', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    await render(AttachmentPreview, {
      inputs: { attachment: fakeAttachment({ id: 'a42' }) },
      on: { deleted: onDeleted },
    });

    await user.click(screen.getByRole('button', { name: /delete attachment/i }));

    expect(onDeleted).toHaveBeenCalledWith('a42');
  });
});
