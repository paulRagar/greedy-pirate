import { SVGProps, forwardRef, Ref } from 'react';
const SvgSquirrel = (props: SVGProps<SVGSVGElement>, ref: Ref<SVGSVGElement>) => (
   <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 64 80'
      width={props.width || '100%'}
      height={props.height || '100%'}
      ref={ref}
      {...props}>
      <g data-name={24}>
         <path d='M34.5 36h-5a9.5 9.5 0 0 0 0 19h5a9.5 9.5 0 0 0 0-19Zm0 17h-5a7.5 7.5 0 0 1 0-15h5a7.5 7.5 0 0 1 0 15Z' />
         <path d='M34.59 40h-5.18A2 2 0 0 0 28 43.41L30.59 46a2 2 0 0 0 .41.31V48h-1a1 1 0 0 0 0 2v1a1 1 0 0 0 2 0 1 1 0 0 0 2 0v-1a1 1 0 0 0 0-2h-1v-1.69a2 2 0 0 0 .41-.31L36 43.41A2 2 0 0 0 34.59 40ZM32 44.59 29.4 42h5.18Z' />
         <path d='M49.13 5.16a2.53 2.53 0 0 0-2.88 1.14l-4 6.69a13.86 13.86 0 0 0-5.11-1H26.88a13.86 13.86 0 0 0-5.11 1l-4-6.69A2.56 2.56 0 0 0 13 7.62v18.26l.08 2.65a5.94 5.94 0 0 0-.08 1 5.8 5.8 0 0 0 .15 1.26L13.47 41a18.54 18.54 0 0 0 37.06 0l.32-10.29A5.8 5.8 0 0 0 51 29.5a6 6 0 0 0-.08-1L51 26V7.62a2.53 2.53 0 0 0-1.87-2.46ZM15 18.72V7.62a.53.53 0 0 1 .41-.54h.17a.51.51 0 0 1 .46.27l3.92 6.51-.07.05a13.75 13.75 0 0 0-1.33.89l-.09.06a13.84 13.84 0 0 0-1.19 1l-.17.16a14 14 0 0 0-1 1.14l-.16.21a14 14 0 0 0-.86 1.25Zm.09 10c.22-1 .84-1.73 1.41-1.73S18 28 18 29.5s-.79 2.5-1.5 2.5c-.53 0-1.1-.57-1.36-1.47ZM32 57a16.47 16.47 0 0 1-16.53-16l-.23-7.28a2.88 2.88 0 0 0 1.26.3c2 0 3.5-2 3.5-4.5S18.46 25 16.5 25a2.9 2.9 0 0 0-1.48.42v-.39a11.78 11.78 0 0 1 .24-1.67A11.85 11.85 0 0 1 26.88 14h10.24A11.85 11.85 0 0 1 49 25.42a2.9 2.9 0 0 0-1.5-.42c-2 0-3.5 2-3.5 4.5s1.54 4.5 3.5 4.5a2.88 2.88 0 0 0 1.26-.3l-.23 7.3A16.47 16.47 0 0 1 32 57Zm16.86-26.47C48.6 31.43 48 32 47.5 32c-.71 0-1.5-1-1.5-2.5s.79-2.5 1.5-2.5 1.2.68 1.41 1.73Zm-.77-13.13-.17-.22a14 14 0 0 0-1-1.13l-.18-.17a13.86 13.86 0 0 0-1.18-1l-.1-.07a13.78 13.78 0 0 0-1.31-.88l-.08-.05L48 7.33a.56.56 0 0 1 1 .29v11.1l-.05-.08a14 14 0 0 0-.86-1.24Z' />
      </g>
   </svg>
);
const ForwardRef = forwardRef(SvgSquirrel);
export default ForwardRef;
