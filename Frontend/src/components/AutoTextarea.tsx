import React, { useRef, useEffect } from "react";

type AutoTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export default function AutoTextarea({ value, style, ...rest }: AutoTextareaProps) {
    const ref = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    }, [value]);

    return (
        <textarea
            ref={ref}
            value={value}
            style={{ ...style, overflow: "hidden", resize: "none" }}
            {...rest}
        />
    );
}
