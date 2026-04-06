import React from "react";

interface FormattedContentProps {
  text: string;
  className?: string;
  itemClassName?: string;
}

export const FormattedContent: React.FC<FormattedContentProps> = ({ 
  text, 
  className = "text-lg text-muted-foreground leading-relaxed",
  itemClassName = "flex gap-4"
}) => {
  if (!text) return null;

  // Split by newlines first to handle potential breaks
  const lines = text.split(/\n+/).filter(line => line.trim() !== "");

  // Helper to detect if a line is a list item
  const isListItem = (line: string) => /^\d+\.\s|^\* |^- /.test(line.trim());

  // Group lines into blocks (either a list or a paragraph)
  const blocks: { type: "list" | "paragraph"; items: string[] }[] = [];
  let currentBlock: { type: "list" | "paragraph"; items: string[] } | null = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    const type = isListItem(trimmed) ? "list" : "paragraph";

    if (!currentBlock || currentBlock.type !== type) {
      currentBlock = { type, items: [trimmed] };
      blocks.push(currentBlock);
    } else {
      currentBlock.items.push(trimmed);
    }
  });

  return (
    <div className="space-y-6">
      {blocks.map((block, bIdx) => {
        if (block.type === "list") {
          return (
            <ul key={bIdx} className="space-y-4">
              {block.items.map((item, iIdx) => (
                <li key={iIdx} className={itemClassName}>
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-accent mt-3 shadow-glow" />
                  <span className={className}>{item.replace(/^\d+\.\s|^\* |^- /, "")}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <div key={bIdx} className="space-y-4">
            {block.items.map((item, iIdx) => (
              <p key={iIdx} className={className}>{item}</p>
            ))}
          </div>
        );
      })}
    </div>
  );
};
