import { Button } from "#/components/ui/button.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";
import { Textarea } from "#/components/ui/textarea.tsx";
import { formatAgo } from "#/lib/age.ts";

interface Comment {
	body: string;
	createdAt: string;
	id: string;
}

interface Props {
	comments: Comment[];
	commentText: string;
	isClosed: boolean;
	onChange: (v: string) => void;
	onSubmit: () => void;
	pending: boolean;
}

export function DocumentComments({
	comments,
	commentText,
	isClosed,
	onChange,
	onSubmit,
	pending,
}: Props) {
	return (
		<div className="space-y-4">
			<h2 className="font-semibold text-sm">Comments ({comments.length})</h2>
			{comments.map((comment) => (
				<Card className="rounded-md border" key={comment.id}>
					<CardContent className="p-4">
						<p className="text-muted-foreground text-xs">
							{formatAgo(comment.createdAt)}
						</p>
						<p className="mt-2 text-sm leading-6">{comment.body}</p>
					</CardContent>
				</Card>
			))}
			<label className="sr-only" htmlFor="doc-comment">
				New comment
			</label>
			<Textarea
				aria-label="New comment"
				className="text-sm"
				disabled={isClosed}
				id="doc-comment"
				onChange={(e) => onChange(e.target.value)}
				placeholder={
					isClosed
						? "Comments locked while closed — reopen to comment"
						: "Write a comment…"
				}
				value={commentText}
			/>
			<div className="flex justify-end">
				<Button
					disabled={!commentText.trim() || pending || isClosed}
					onClick={onSubmit}
					size="sm"
					variant="primary"
				>
					Comment
				</Button>
			</div>
		</div>
	);
}
