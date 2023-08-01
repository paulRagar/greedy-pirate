import Image from 'next/image';
import { Inter } from 'next/font/google';
import styles from './page.module.css';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'] });

export default function Home() {
   return <Link className='bg-green-500 rounded p-4 text-white' href={'/home'}>{`Let's Play Nut Nut Squirrel!`}</Link>;
}
