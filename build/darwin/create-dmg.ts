/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = path.dirname(path.dirname(import.meta.dirname));
const product = JSON.parse(fs.readFileSync(path.join(root, 'product.json'), 'utf8'));

/**
 * Get the size of a directory in bytes
 */
function getDirectorySize(dirPath: string): number {
	let totalSize = 0;

	const files = fs.readdirSync(dirPath);
	for (const file of files) {
		const filePath = path.join(dirPath, file);
		const stats = fs.statSync(filePath);

		if (stats.isDirectory()) {
			totalSize += getDirectorySize(filePath);
		} else {
			totalSize += stats.size;
		}
	}

	return totalSize;
}

/**
 * Create a DMG file from a .app bundle using native hdiutil
 */
async function createDMG(appPath: string, outputPath: string): Promise<void> {
	const appName = path.basename(appPath);
	const dmgName = path.basename(outputPath, '.dmg');
	const tempDmgPath = outputPath.replace('.dmg', '-temp.dmg');
	const volumeName = product.nameLong || 'Code - OSS';

	// Validate app exists
	if (!fs.existsSync(appPath)) {
		throw new Error(`App not found: ${appPath}`);
	}

	// Calculate required size (app size + 50MB buffer for filesystem overhead)
	const appSize = getDirectorySize(appPath);
	const requiredSizeMB = Math.ceil(appSize / (1024 * 1024)) + 50;

	console.log(`App size: ${Math.round(appSize / (1024 * 1024))}MB`);
	console.log(`Creating DMG with ${requiredSizeMB}MB capacity...`);

	// Ensure output directory exists
	const outputDir = path.dirname(outputPath);
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	// Remove existing DMG files if they exist
	if (fs.existsSync(tempDmgPath)) {
		fs.unlinkSync(tempDmgPath);
	}
	if (fs.existsSync(outputPath)) {
		fs.unlinkSync(outputPath);
	}

	try {
		// Step 1: Create a temporary writable DMG
		console.log('Creating temporary DMG...');
		execSync(
			`hdiutil create -srcfolder "${appPath}" -volname "${volumeName}" -fs HFS+ -fsargs "-c c=64,a=16,e=16" -format UDRW -size ${requiredSizeMB}m "${tempDmgPath}"`,
			{ stdio: 'inherit' }
		);

		// Step 2: Mount the DMG to add Applications symlink
		console.log('Mounting DMG to add Applications symlink...');
		const mountOutput = execSync(`hdiutil attach "${tempDmgPath}" -readwrite -noverify -noautoopen`).toString();

		// Parse mount point from output
		const mountMatch = mountOutput.match(/\/Volumes\/[^\n]+/);
		if (!mountMatch) {
			throw new Error('Failed to parse mount point from hdiutil output');
		}
		const mountPoint = mountMatch[0].trim();
		console.log(`Mounted at: ${mountPoint}`);

		try {
			// Add Applications symlink for easy drag-and-drop installation
			const applicationsLink = path.join(mountPoint, 'Applications');
			if (!fs.existsSync(applicationsLink)) {
				execSync(`ln -s /Applications "${applicationsLink}"`);
				console.log('Added Applications symlink');
			}
		} finally {
			// Unmount the DMG
			console.log('Unmounting...');
			execSync(`hdiutil detach "${mountPoint}" -quiet`, { stdio: 'inherit' });
		}

		// Step 3: Convert to compressed read-only DMG
		console.log('Converting to compressed DMG...');
		execSync(
			`hdiutil convert "${tempDmgPath}" -format UDZO -imagekey zlib-level=9 -o "${outputPath}"`,
			{ stdio: 'inherit' }
		);

		console.log(`DMG created successfully: ${outputPath}`);

		// Get final file size
		const finalStats = fs.statSync(outputPath);
		console.log(`Final DMG size: ${Math.round(finalStats.size / (1024 * 1024))}MB`);
	} finally {
		// Clean up temporary DMG
		if (fs.existsSync(tempDmgPath)) {
			fs.unlinkSync(tempDmgPath);
		}
	}
}

// CLI interface
if (import.meta.main) {
	const args = process.argv.slice(2);

	if (args.length < 2) {
		console.log('Usage: create-dmg.ts <app-path> <output-dmg-path>');
		console.log('');
		console.log('Example:');
		console.log('  node build/darwin/create-dmg.ts ".build/electron/Code - OSS.app" ".build/Code-OSS-darwin-arm64.dmg"');
		process.exit(1);
	}

	const [appPath, outputPath] = args;

	createDMG(appPath, outputPath).catch(err => {
		console.error('Failed to create DMG:', err);
		process.exit(1);
	});
}

export { createDMG };
