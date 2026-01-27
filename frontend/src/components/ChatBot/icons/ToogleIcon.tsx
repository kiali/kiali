import React from 'react';

const paths = [
  'M349.9,8.3c-107.3,0-194.2,87-194.2,194.2c0,107.3,87,194.2,194.2,194.2s194.2-87,194.2-194.2C544.1,95.3,457.1,8.3,349.9,8.3z M349.9,367.2c-90.9,0-164.7-73.7-164.7-164.7c0-90.9,73.7-164.7,164.7-164.7s164.7,73.7,164.7,164.7C514.5,293.5,440.8,367.2,349.9,367.2z',
  'M144.1,202.5c0-47.9,16.4-92,43.9-127c-13.7-4.8-28.5-7.5-43.9-7.5C70.6,68.1,11,128.3,11,202.5C11,276.8,70.6,337,144.2,337c15.3,0,30.1-2.7,43.8-7.5C159.5,293.4,144.1,249.2,144.1,202.5z',
  'M292.4,60.7c-56,22.8-95.6,77.8-95.6,141.9c0,64.1,39.6,119.1,95.6,141.9c36.2-36.4,58.6-86.5,58.6-141.9S328.6,97,292.4,60.7z'
];

const Icon = ({ fill }: { fill: string }) => (
  <svg
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 560 400"
    role="img"
    aria-hidden="true"
    style={{ height: '2.5rem', width: '2.5rem' }}
  >
    <g>
      {paths.map((d, idx) => (
        <path key={idx} d={d} fill={fill} />
      ))}
    </g>
  </svg>
);

const LightIcon: () => JSX.Element = () => <Icon fill="#FFFFFF" />;
const DarkIcon: () => JSX.Element = () => <Icon fill="#000000" />;

export const ToggleIcon = (darkTheme: boolean): JSX.Element => (darkTheme ? <DarkIcon /> : <LightIcon />);
