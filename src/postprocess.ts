/**
 * ADF postprocessing — patch the ADF tree for features Atlaskit doesn't handle.
 */

import { randomUUID } from "node:crypto";

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

		// taskItem holds inline content directly (not wrapped in paragraph)
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
 */
function applyLinkedImages(node: AdfNode, linkedImages: Map<string, string>): AdfNode {
	if (node.type === "mediaSingle" && node.content?.length && node.content[0]?.type === "media") {
		const media = node.content[0];
		const imgUrl = media.attrs?.url as string | undefined;
		if (imgUrl && linkedImages.has(imgUrl)) {
			const linkUrl = linkedImages.get(imgUrl)!;
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
	return node;
}

/**
 * Recursively walk and transform the ADF tree.
 */
function walkNodes(nodes: AdfNode[], linkedImages: Map<string, string>): AdfNode[] {
	return nodes.map((node) => {
		// First, recurse into children
		let transformed = node;
		if (transformed.content?.length) {
			transformed = {
				...transformed,
				content: walkNodes(transformed.content, linkedImages),
			};
		}

		// Apply task list conversion
		transformed = convertBulletListToTaskList(transformed);

		// Apply linked images
		transformed = applyLinkedImages(transformed, linkedImages);

		return transformed;
	});
}

/**
 * Run all ADF postprocessing steps.
 */
export function postprocessAdf(adf: AdfDoc, linkedImages: Map<string, string>): AdfDoc {
	return {
		...adf,
		content: walkNodes(adf.content, linkedImages),
	};
}
