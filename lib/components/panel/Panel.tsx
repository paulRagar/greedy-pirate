type Props = {
   children: React.ReactNode;
};

const Panel = ({ children }: Props) => {
   return <div className='flex flex-col items-center p-4 rounded shadow-lg bg-white dark:bg-slate-600'>{children}</div>;
};

export default Panel;
