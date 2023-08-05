type Props = {
   children: React.ReactNode;
};

const Page = ({ children }: Props) => {
   return (
      <div className='absolute left-[50%] top-[50%] transform translate-x-[-50%] translate-y-[-50%]'>{children}</div>
   );
};

export default Page;
