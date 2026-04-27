import { Poppins, Montserrat } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-montserrat',
});

export const metadata = {
  title: 'AsmitA Property Tracker',
  description: 'Internal ERP for Property Management',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${poppins.variable} ${montserrat.variable}`}>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <Toaster 
          position="top-right" 
          containerStyle={{
            zIndex: 100000,
          }}
          toastOptions={{
            style: {
              zIndex: 100001,
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}