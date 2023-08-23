'use client';
import Button from '@/components/button/Button';
import Page from '@/components/page/Page';
import { useRouter } from 'next/navigation';

type Props = {};

const NotFound = ({}: Props) => {
   const router = useRouter();
   return (
      <Page>
         <div className='flex flex-col items-center gap-2'>
            <div className='text-9xl font-semibold text-yellow-500'>404</div>
            <span className='text-2xl font-semibold'>{`Arrr Matey! Yer map's led ye astray!`}</span>
            <span className='text-lg text-secondary text-center'>{`This page be buried deep, or it never existed anyway! Navigate yerself back to safer waters, or we'll make ye walk the plank!`}</span>
            <Button color='purple' onClick={() => router.push('/home')}>
               Sail Home
            </Button>
         </div>
      </Page>
   );
};

export default NotFound;
