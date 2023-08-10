import styles from './Checkbox.module.css';

type Props = {
   label?: string;
   className?: string;
};

const Checkbox = ({ className, label, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & Props) => {
   return (
      <label
         onClick={(e: any) => {
            e.stopPropagation();
         }}
         className={`
            group 
            text-sm text-secondary
            ${styles.container} 
            ${className && className}
         `}>
         {label ? <span>{label}</span> : <>&nbsp;</>}
         <input type='checkbox' {...rest} />
         <span
            className={`dark:bg-gray-800 dark:group-hover:bg-gray-700 dark:border-gray-600 ${styles.checkmark}`}></span>
      </label>
   );
};

export default Checkbox;
