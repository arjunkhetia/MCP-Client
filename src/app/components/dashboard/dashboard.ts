import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { McpContentItem, McpService } from '../../services/mcp.service';

interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  lines: number;
  readingTimeSeconds: number;
}

interface SampleFile {
  name: string;
  size: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {
  constructor(protected mcp: McpService) {}

  ngOnInit(): void {
    void this.mcp.connect();
  }

  reconnect(): void {
    void this.mcp.connect();
  }

  // --- Tool 1: ping ---
  pingMessage = signal('Hello from Angular!');
  pingResult = signal<string | null>(null);
  pingLoading = signal(false);
  pingError = signal<string | null>(null);

  async runPing(): Promise<void> {
    this.pingLoading.set(true);
    this.pingError.set(null);
    try {
      const content = await this.mcp.callTool('ping', {
        message: this.pingMessage() || undefined
      });
      this.pingResult.set(firstText(content));
    } catch (err) {
      this.pingError.set(errorMessage(err));
    } finally {
      this.pingLoading.set(false);
    }
  }

  // --- Tool 2: text-stats ---
  statsText = signal('The quick brown fox jumps over the lazy dog. It ran fast!');
  statsResult = signal<TextStats | null>(null);
  statsLoading = signal(false);
  statsError = signal<string | null>(null);

  async runTextStats(): Promise<void> {
    if (!this.statsText().trim()) {
      return;
    }
    this.statsLoading.set(true);
    this.statsError.set(null);
    try {
      const content = await this.mcp.callTool('text-stats', { text: this.statsText() });
      const text = firstText(content);
      this.statsResult.set(text ? JSON.parse(text) : null);
    } catch (err) {
      this.statsError.set(errorMessage(err));
    } finally {
      this.statsLoading.set(false);
    }
  }

  // --- Tool 3: generate-avatar ---
  avatarSeed = signal('arjunkhetia');
  avatarSize = signal(256);
  avatarImage = signal<string | null>(null);
  avatarLoading = signal(false);
  avatarError = signal<string | null>(null);

  async runGenerateAvatar(): Promise<void> {
    if (!this.avatarSeed().trim()) {
      return;
    }
    this.avatarLoading.set(true);
    this.avatarError.set(null);
    try {
      const content = await this.mcp.callTool('generate-avatar', {
        seed: this.avatarSeed(),
        size: this.avatarSize()
      });
      const image = content.find((item) => item.type === 'image');
      this.avatarImage.set(
        image?.data ? `data:${image.mimeType || 'image/svg+xml'};base64,${image.data}` : null
      );
    } catch (err) {
      this.avatarError.set(errorMessage(err));
    } finally {
      this.avatarLoading.set(false);
    }
  }

  // --- Tool 4: list-files ---
  files = signal<SampleFile[]>([]);
  filesLoading = signal(false);
  filesError = signal<string | null>(null);

  async runListFiles(): Promise<void> {
    this.filesLoading.set(true);
    this.filesError.set(null);
    try {
      const content = await this.mcp.callTool('list-files', {});
      const text = firstText(content) || '';
      this.files.set(text === 'No sample files found.' ? [] : parseFileList(text));
    } catch (err) {
      this.filesError.set(errorMessage(err));
    } finally {
      this.filesLoading.set(false);
    }
  }

  // --- Tool 5: read-file ---
  readFilename = signal('welcome.txt');
  readFileResult = signal<string | null>(null);
  readFileLoading = signal(false);
  readFileError = signal<string | null>(null);

  async runReadFile(filename?: string): Promise<void> {
    const target = (filename ?? this.readFilename()).trim();
    if (!target) {
      return;
    }
    this.readFilename.set(target);
    this.readFileLoading.set(true);
    this.readFileError.set(null);
    try {
      const content = await this.mcp.callTool('read-file', { filename: target });
      this.readFileResult.set(firstText(content));
    } catch (err) {
      this.readFileError.set(errorMessage(err));
    } finally {
      this.readFileLoading.set(false);
    }
  }

  // --- Tool 6: roll-dice ---
  diceSides = signal(6);
  diceCount = signal(1);
  diceResult = signal<string | null>(null);
  diceLoading = signal(false);
  diceError = signal<string | null>(null);

  async runRollDice(): Promise<void> {
    this.diceLoading.set(true);
    this.diceError.set(null);
    try {
      const content = await this.mcp.callTool('roll-dice', {
        sides: this.diceSides(),
        count: this.diceCount()
      });
      this.diceResult.set(firstText(content));
    } catch (err) {
      this.diceError.set(errorMessage(err));
    } finally {
      this.diceLoading.set(false);
    }
  }
}

function firstText(content: McpContentItem[]): string | null {
  return content.find((item) => item.type === 'text')?.text ?? null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}

// Entries look like "welcome.txt (245 bytes)" - split the trailing "(N bytes)" back out.
function parseFileList(text: string): SampleFile[] {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*) \(([^)]+)\)$/);
      return match ? { name: match[1], size: match[2] } : { name: line, size: '' };
    });
}
