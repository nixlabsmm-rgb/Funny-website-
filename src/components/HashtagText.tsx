import React from 'react';

interface HashtagTextProps {
  text: string;
}

export default function HashtagText(props: HashtagTextProps) {
  const words = props.text.split(/(\s+)/);
  return (
    <span className="break-words">
      {words.map((word, idx) => {
        if (word.startsWith('#') && word.length > 1) {
          return (
            <span
              id={`hashtag-${idx}`}
              key={idx}
              className="text-emerald-500 font-semibold dark:text-emerald-400 hover:underline cursor-pointer"
            >
              {word}
            </span>
          );
        }
        return <span key={idx}>{word}</span>;
      })}
    </span>
  );
}
export { HashtagText };
