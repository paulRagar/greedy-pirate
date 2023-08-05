import { SVGProps, forwardRef, Ref } from 'react';
const SvgNotAllowed = (props: SVGProps<SVGSVGElement>, ref: Ref<SVGSVGElement>) => (
   <svg
      xmlns='http://www.w3.org/2000/svg'
      data-name='Layer 1'
      viewBox='0 0 100 125'
      width={props.width || '100%'}
      height={props.height || '100%'}
      ref={ref}
      {...props}>
      <path d='M50 18a32 32 0 1 0 32 32 32 32 0 0 0-32-32Zm0 56a24 24 0 0 1-19.75-37.61l33.36 33.36A23.86 23.86 0 0 1 50 74Zm19.35-9.82L35.82 30.65a24 24 0 0 1 33.53 33.53Z' />
   </svg>
);
const ForwardRef = forwardRef(SvgNotAllowed);
export default ForwardRef;
