import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { StorageService } from '../../../../core/services/storage.service';
import { AttachmentSection } from './attachment-section';
import type { Attachment } from '../../../../shared/types/board';

function fakeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'a1',
    fileName: 'existing.png',
    fileSize: 2048,
    fileType: 'image/png',
    storagePath: 'boards/board-1/tasks/task-1/attachments/a1.png',
    downloadUrl: 'https://example.com/existing.png',
    uploadedAt: Date.now(),
    ...overrides,
  };
}

function setup(
  overrides: {
    uploadTaskAttachment?: ReturnType<typeof vi.fn>;
    deleteTaskAttachment?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const uploadTaskAttachment =
    overrides.uploadTaskAttachment ?? vi.fn().mockResolvedValue(fakeAttachment());
  const deleteTaskAttachment =
    overrides.deleteTaskAttachment ?? vi.fn().mockResolvedValue(undefined);
  return {
    uploadTaskAttachment,
    deleteTaskAttachment,
    providers: [
      { provide: StorageService, useValue: { uploadTaskAttachment, deleteTaskAttachment } },
    ],
  };
}

describe('AttachmentSection', () => {
  it('renders existing attachments passed in via the attachments input', async () => {
    const { providers } = setup();

    await render(AttachmentSection, {
      providers,
      inputs: {
        boardId: 'board-1',
        taskId: 'task-1',
        attachments: [fakeAttachment({ fileName: 'existing.png' })],
      },
    });

    expect(screen.getByText('existing.png')).toBeInTheDocument();
  });

  it('uploads a selected file and emits attachmentsChange with it appended once the upload resolves', async () => {
    const user = userEvent.setup();
    const newAttachment = fakeAttachment({
      id: 'a2',
      fileName: 'new.png',
      downloadUrl: 'https://example.com/new.png',
    });
    const { providers, uploadTaskAttachment } = setup({
      uploadTaskAttachment: vi.fn().mockResolvedValue(newAttachment),
    });
    const existing = fakeAttachment({ id: 'a1', fileName: 'existing.png' });
    const onAttachmentsChange = vi.fn();

    const view = await render(AttachmentSection, {
      providers,
      inputs: { boardId: 'board-1', taskId: 'task-1', attachments: [existing] },
      on: { attachmentsChange: onAttachmentsChange },
    });

    const fileInput = view.container.querySelector('input[type=file]') as HTMLInputElement;
    const file = new File(['content'], 'new.png', { type: 'image/png' });
    await user.upload(fileInput, file);

    expect(uploadTaskAttachment).toHaveBeenCalledWith(
      'board-1',
      'task-1',
      file,
      expect.any(Function),
    );
    await waitFor(() =>
      expect(onAttachmentsChange).toHaveBeenCalledWith([existing, newAttachment]),
    );
  });

  it('shows an error message when the upload rejects', async () => {
    const user = userEvent.setup();
    const { providers } = setup({
      uploadTaskAttachment: vi
        .fn()
        .mockRejectedValue(new Error('Only images and videos are allowed as attachments.')),
    });

    const view = await render(AttachmentSection, {
      providers,
      inputs: { boardId: 'board-1', taskId: 'task-1' },
    });

    // Use a type accepted by the input's `accept` attribute so userEvent.upload
    // actually dispatches it — the rejection below comes from the mocked
    // StorageService, not the input's own file-type filtering.
    const fileInput = view.container.querySelector('input[type=file]') as HTMLInputElement;
    const file = new File(['content'], 'bad.png', { type: 'image/png' });
    await user.upload(fileInput, file);

    expect(
      await screen.findByText('Only images and videos are allowed as attachments.'),
    ).toBeInTheDocument();
  });

  it('removes an attachment, calling deleteTaskAttachment with its storagePath and emitting the filtered list', async () => {
    const user = userEvent.setup();
    const existing = fakeAttachment({
      id: 'a1',
      fileName: 'existing.png',
      storagePath: 'boards/board-1/tasks/task-1/attachments/a1.png',
    });
    const { providers, deleteTaskAttachment } = setup();
    const onAttachmentsChange = vi.fn();

    await render(AttachmentSection, {
      providers,
      inputs: { boardId: 'board-1', taskId: 'task-1', attachments: [existing] },
      on: { attachmentsChange: onAttachmentsChange },
    });

    await user.click(screen.getByRole('button', { name: /delete attachment/i }));

    expect(deleteTaskAttachment).toHaveBeenCalledWith(
      'boards/board-1/tasks/task-1/attachments/a1.png',
    );
    expect(onAttachmentsChange).toHaveBeenCalledWith([]);
  });

  it('opens the file picker when the "Add attachment" button is clicked', async () => {
    const user = userEvent.setup();
    const { providers } = setup();

    const view = await render(AttachmentSection, {
      providers,
      inputs: { boardId: 'board-1', taskId: 'task-1' },
    });

    const fileInput = view.container.querySelector('input[type=file]') as HTMLInputElement;
    const click = vi.spyOn(fileInput, 'click').mockImplementation(() => {});

    await user.click(screen.getByRole('button', { name: /add attachment/i }));

    expect(click).toHaveBeenCalled();
  });

  it('shows an upload progress row while the upload is in flight', async () => {
    const user = userEvent.setup();
    let capturedProgress: ((progress: number) => void) | undefined;
    let resolveUpload!: (attachment: Attachment) => void;

    const uploadTaskAttachment = vi.fn(
      (_b: string, _t: string, _f: File, onProgress: (progress: number) => void) => {
        capturedProgress = onProgress;
        return new Promise<Attachment>((r) => (resolveUpload = r));
      },
    );
    const { providers } = setup({ uploadTaskAttachment });

    const view = await render(AttachmentSection, {
      providers,
      inputs: { boardId: 'board-1', taskId: 'task-1' },
    });

    const fileInput = view.container.querySelector('input[type=file]') as HTMLInputElement;
    const file = new File(['content'], 'progress.png', { type: 'image/png' });
    await user.upload(fileInput, file);

    // In-flight upload row is shown.
    expect(await screen.findByText('progress.png')).toBeInTheDocument();
    expect(screen.getByText(/uploading · 0%/i)).toBeInTheDocument();

    // Progress updates propagate through the callback the component provided.
    capturedProgress?.(50);
    view.fixture.detectChanges();
    expect(screen.getByText(/uploading · 50%/i)).toBeInTheDocument();

    // Once the upload resolves the row disappears and attachmentsChange fires.
    resolveUpload(
      fakeAttachment({
        id: 'new',
        fileName: 'progress.png',
        downloadUrl: 'https://example.com/p.png',
      }),
    );
    await waitFor(() => expect(screen.queryByText(/uploading/i)).not.toBeInTheDocument());
  });

  it('is a no-op when removing an attachment id that is not in the current list', async () => {
    const { providers, deleteTaskAttachment } = setup();

    const view = await render(AttachmentSection, {
      providers,
      inputs: { boardId: 'board-1', taskId: 'task-1', attachments: [fakeAttachment({ id: 'a1' })] },
    });

    view.fixture.componentInstance['removeAttachment']('ghost');

    expect(deleteTaskAttachment).not.toHaveBeenCalled();
  });
});
