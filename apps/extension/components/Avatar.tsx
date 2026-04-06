interface AvatarProps {
  src?: string | null;
  size?: "sm" | "md" | "lg";
  class?: string;
}

const sizeMap = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
};

export default function Avatar(props: AvatarProps) {
  const sizeClass = () => sizeMap[props.size || "md"];

  return props.src ? (
    <img
      src={props.src}
      alt=""
      class={`${sizeClass()} rounded-full flex-shrink-0 ${props.class || ""}`}
    />
  ) : (
    <div class={`${sizeClass()} rounded-full bg-muted/50 flex-shrink-0 ${props.class || ""}`} />
  );
}
