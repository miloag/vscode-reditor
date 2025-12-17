/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../base/common/lifecycle.js';
import { TerminalShellType } from '../common/terminal.js';

export interface IWindowsShellHelper extends IDisposable {
	readonly onShellNameChanged: Event<string>;
	readonly onShellTypeChanged: Event<TerminalShellType | undefined>;
	getShellType(title: string): TerminalShellType | undefined;
	getShellName(): Promise<string>;
}

/**
 * Windows-only shell helper - stub for macOS builds
 */
export class WindowsShellHelper extends Disposable implements IWindowsShellHelper {
	private readonly _onShellNameChanged = new Emitter<string>();
	get onShellNameChanged(): Event<string> { return this._onShellNameChanged.event; }
	private readonly _onShellTypeChanged = new Emitter<TerminalShellType | undefined>();
	get onShellTypeChanged(): Event<TerminalShellType | undefined> { return this._onShellTypeChanged.event; }

	get shellTitle(): string { return ''; }
	get shellType(): TerminalShellType | undefined { return undefined; }

	constructor(_rootProcessId: number) {
		super();
		throw new Error('WindowsShellHelper is not available on macOS');
	}

	checkShell(): void {
		// Not implemented on macOS
	}

	async getShellName(): Promise<string> {
		return '';
	}

	getShellType(_executable: string): TerminalShellType | undefined {
		return undefined;
	}
}
