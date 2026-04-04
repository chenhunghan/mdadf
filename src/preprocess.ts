/**
 * Markdown preprocessing — fix patterns that Atlaskit doesn't handle well.
 */

/**
 * Flatten nested blockquotes (>> text) to single-level (> text).
 * ADF doesn't support nested blockquotes, and Atlaskit produces empty output for them.
 */
export function flattenNestedBlockquotes(md: string): string {
	return md.replace(/^(>{2,})\s?/gm, "> ");
}

/**
 * Convert linked images [![alt](img)](url) to a placeholder token
 * that we can reconstruct in postprocessing.
 *
 * The Atlaskit parser breaks linked images into broken fragments:
 *   "[", mediaSingle, "](url)"
 *
 * Strategy: replace [![alt](img)](url) with just ![alt](img) and store
 * the link URL in a side-channel map keyed by image URL.
 * Post-processing will attach the link mark to the mediaSingle node.
 */
export interface LinkedImage {
	alt: string;
	imgUrl: string;
	linkUrl: string;
}

export function extractLinkedImages(md: string): {
	processed: string;
	linkedImages: Map<string, string>;
} {
	const linkedImages = new Map<string, string>();
	const processed = md.replace(
		/\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g,
		(_match, alt: string, imgUrl: string, linkUrl: string) => {
			linkedImages.set(imgUrl, linkUrl);
			return `![${alt}](${imgUrl})`;
		},
	);
	return { processed, linkedImages };
}

/**
 * Run all markdown preprocessing steps.
 */
export function preprocessMarkdown(md: string): {
	processed: string;
	linkedImages: Map<string, string>;
} {
	let result = flattenNestedBlockquotes(md);
	const { processed, linkedImages } = extractLinkedImages(result);
	result = processed;
	return { processed: result, linkedImages };
}
