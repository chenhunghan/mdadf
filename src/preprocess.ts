/**
 * Markdown preprocessing — fix patterns that Atlaskit doesn't handle well.
 */

/**
 * Flatten nested blockquotes (>> text) to single-level (> text).
 * ADF doesn't support nested blockquotes, and Atlaskit produces empty output for them.
 *
 * Code-fence aware: splits on fenced code blocks first to avoid corrupting
 * content like shell heredocs (>>) inside code.
 */
export function flattenNestedBlockquotes(md: string): string {
	// Split on fenced code blocks (``` or ~~~), preserving them
	const parts = md.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/gm);
	return parts
		.map((part, i) =>
			// Even indices are outside code fences, odd indices are code blocks
			i % 2 === 0 ? part.replace(/^(>{2,})\s?/gm, "> ") : part,
		)
		.join("");
}

/**
 * Convert linked images [![alt](img)](url) to plain images and track
 * the link URLs for postprocessing.
 *
 * The Atlaskit parser breaks linked images into broken fragments:
 *   "[", mediaSingle, "](url)"
 *
 * Strategy: replace [![alt](img)](url) with just ![alt](img) and store
 * the link URL in an ordered array. Post-processing matches by image URL
 * and occurrence order to avoid collisions when the same image URL
 * appears with different link targets.
 */
export interface LinkedImage {
	imgUrl: string;
	linkUrl: string;
}

/**
 * Match a parenthesized URL that may contain balanced parens.
 * Handles one level of nesting: (https://example.com/a_(1).png)
 * Uses a pattern that allows nested () inside the URL.
 */
const PAREN_URL = "(?:[^()]*(?:\\([^()]*\\))?[^()]*)*";

// Full linked image pattern: [![alt](imgUrl)](linkUrl)
const LINKED_IMAGE_RE = new RegExp(
	`\\[!\\[([^\\]]*)\\]\\((${PAREN_URL})\\)\\]\\((${PAREN_URL})\\)`,
	"g",
);

/**
 * Percent-encode literal parentheses in a URL so markdown-it can parse it.
 * markdown-it treats unescaped ( ) as URL delimiters and breaks on them.
 */
function encodeParensInUrl(url: string): string {
	return url.replace(/\(/g, "%28").replace(/\)/g, "%29");
}

export function extractLinkedImages(md: string): {
	processed: string;
	linkedImages: LinkedImage[];
} {
	const linkedImages: LinkedImage[] = [];
	const processed = md.replace(
		LINKED_IMAGE_RE,
		(_match, _alt: string, imgUrl: string, linkUrl: string) => {
			linkedImages.push({ imgUrl: encodeParensInUrl(imgUrl), linkUrl });
			return `![${_alt}](${encodeParensInUrl(imgUrl)})`;
		},
	);
	return { processed, linkedImages };
}

/**
 * Run all markdown preprocessing steps.
 */
export function preprocessMarkdown(md: string): {
	processed: string;
	linkedImages: LinkedImage[];
} {
	const flattened = flattenNestedBlockquotes(md);
	const { processed, linkedImages } = extractLinkedImages(flattened);
	return { processed, linkedImages };
}
