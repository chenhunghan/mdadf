/**
 * ADF postprocessing — patch the ADF tree for features Atlaskit doesn't handle.
 */

import { randomUUID } from "node:crypto";
import type { LinkedImage } from "./preprocess";

// ADF node types used in postprocessing
interface AdfNode {
	type: string;
	attrs?: Record<string, unknown>;
	content?: AdfNode[];
	marks?: AdfMark[];
	text?: string;
}

interface AdfMark {
	type: string;
	attrs?: Record<string, unknown>;
}

interface AdfDoc {
	version: number;
	type: "doc";
	content: AdfNode[];
}

/**
 * Convert bullet lists containing task items ([x]/[ ]) to ADF taskList/taskItem nodes.
 *
 * Detection: a bulletList where ALL listItems have a first paragraph whose
 * first text node starts with "[ ] " or "[x] " (case-insensitive).
 *
 * If only some items match, leave it as a bulletList (mixed lists aren't valid taskLists).
 */
function isTaskItemText(node: AdfNode): { isTask: boolean; done: boolean } {
	if (node.type !== "listItem" || !node.content?.length || node.content[0]?.type !== "paragraph") {
		return { isTask: false, done: false };
	}

	const para = node.content[0];
	if (!para.content?.length) return { isTask: false, done: false };

	const firstTextNode = para.content[0];
	if (firstTextNode?.type !== "text" || !firstTextNode.text) {
		return { isTask: false, done: false };
	}

	const text = firstTextNode.text;
	if (text.startsWith("[x] ") || text.startsWith("[X] ")) {
		return { isTask: true, done: true };
	}
	if (text.startsWith("[ ] ")) {
		return { isTask: true, done: false };
	}
	return { isTask: false, done: false };
}

function convertBulletListToTaskList(node: AdfNode): AdfNode {
	if (node.type !== "bulletList" || !node.content?.length) return node;

	// Check if ALL items are task items
	const taskStates = node.content.map((item) => isTaskItemText(item));
	const allTasks = taskStates.every((s) => s.isTask);
	if (!allTasks) return node;

	// Convert to taskList
	const taskItems: AdfNode[] = node.content.map((listItem, idx) => {
		const state = taskStates[idx];
		const para = listItem.content![0]!;
		const firstText = para.content![0]!;

		// Strip the "[ ] " or "[x] " prefix from the first text node
		const strippedText = firstText.text!.slice(4);
		const newParaContent = [...para.content!];

		if (strippedText.length > 0) {
			newParaContent[0] = { ...firstText, text: strippedText };
		} else {
			newParaContent.shift();
		}

		// taskItem can only hold inline content per ADF spec.
		// Nested lists/blocks from the listItem are dropped (ADF limitation).
		return {
			type: "taskItem",
			attrs: {
				localId: randomUUID(),
				state: state!.done ? "DONE" : "TODO",
			},
			content: newParaContent,
		};
	});

	return {
		type: "taskList",
		attrs: {
			localId: randomUUID(),
		},
		content: taskItems,
	};
}

/**
 * Attach link marks to mediaSingle nodes whose media URL matches a linked image.
 * Uses occurrence-order matching to handle duplicate image URLs correctly.
 */
function applyLinkedImages(node: AdfNode, tracker: LinkedImageTracker): AdfNode {
	if (node.type === "mediaSingle" && node.content?.length && node.content[0]?.type === "media") {
		const media = node.content[0];
		const imgUrl = media.attrs?.url as string | undefined;
		if (imgUrl) {
			const linkUrl = tracker.consumeNext(imgUrl);
			if (linkUrl) {
				return {
					...node,
					marks: [
						...(node.marks || []),
						{
							type: "link",
							attrs: { href: linkUrl },
						},
					],
				};
			}
		}
	}
	return node;
}

/**
 * Tracks linked images by URL with occurrence-order matching.
 * Each call to consumeNext() returns the next link URL for that image URL,
 * preventing collisions when the same image appears with different links.
 */
class LinkedImageTracker {
	private urlQueues = new Map<string, string[]>();

	constructor(linkedImages: LinkedImage[]) {
		for (const { imgUrl, linkUrl } of linkedImages) {
			const queue = this.urlQueues.get(imgUrl) || [];
			queue.push(linkUrl);
			this.urlQueues.set(imgUrl, queue);
		}
	}

	consumeNext(imgUrl: string): string | undefined {
		const queue = this.urlQueues.get(imgUrl);
		if (!queue?.length) return undefined;
		return queue.shift();
	}
}

/**
 * Recursively walk and transform the ADF tree.
 */
function walkNodes(nodes: AdfNode[], tracker: LinkedImageTracker): AdfNode[] {
	return nodes.map((node) => {
		// First, recurse into children
		let transformed = node;
		if (transformed.content?.length) {
			transformed = {
				...transformed,
				content: walkNodes(transformed.content, tracker),
			};
		}

		// Apply task list conversion
		transformed = convertBulletListToTaskList(transformed);

		// Apply linked images
		transformed = applyLinkedImages(transformed, tracker);

		return transformed;
	});
}

/**
 * Run all ADF postprocessing steps.
 */
export function postprocessAdf(adf: AdfDoc, linkedImages: LinkedImage[]): AdfDoc {
	if (!adf.content) {
		return { ...adf, content: [] };
	}
	const tracker = new LinkedImageTracker(linkedImages);
	return {
		...adf,
		content: walkNodes(adf.content, tracker),
	};
}
