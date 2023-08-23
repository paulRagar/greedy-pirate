type Props = {
   className?: string;
   children: React.ReactNode;
};

const Panel = ({ className, children }: Props) => {
   return (
      <div className={`min-h-[343px] min-w-[635px] p-4 rounded shadow-lg bg-gray-50 dark:bg-slate-600 ${className}`}>
         {children}
      </div>
   );
};

export default Panel;
