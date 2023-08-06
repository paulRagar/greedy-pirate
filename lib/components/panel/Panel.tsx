type Props = {
   className?: string;
   children: React.ReactNode;
};

const Panel = ({ className, children }: Props) => {
   return <div className={`p-4 rounded shadow-lg bg-gray-50 dark:bg-slate-600 ${className}`}>{children}</div>;
};

export default Panel;
