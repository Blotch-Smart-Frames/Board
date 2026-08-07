import { render, screen } from '@testing-library/angular';
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

describe('AttachmentPreview', () => {
  it('renders an image preview using the download URL when the file type is an image', async () => {
    await render(AttachmentPreview, { inputs: { attachment: fakeAttachment() } });

    const img = screen.getByRole('img', { name: /photo\.png/i }) as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/photo.png');
  });

  it('does not render an image preview for a non-image file type', async () => {
    await render(AttachmentPreview, {
      inputs: { attachment: fakeAttachment({ fileName: 'clip.mp4', fileType: 'video/mp4' }) },
    });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
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
