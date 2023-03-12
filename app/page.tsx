import Image from "next/image";
import { Inter } from "next/font/google";
import styles from "./page.module.css";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  return (
    <span className="bg-green-500 rounded p-4">
      <span>Let{"'"}s Play Nut Nut Squirrel!</span>
    </span>
  );
}
