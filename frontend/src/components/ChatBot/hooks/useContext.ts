import { useSelector } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { ContextRequest } from 'types/Chatbot';

const generateDescription = (pathname: string, namespaces: string[]): string => {
  if (pathname.startsWith('/console')) {
    return `App List of namespaces ${namespaces.join(',')}`;
  }
  return 'Kiali';
};

export const useContext = (): ContextRequest => {
  const namespaces = useSelector((state: KialiAppState) => state.namespaces.activeNamespaces.map(ns => ns.name));
  let pathname = window.location.pathname;

  if (pathname.startsWith('/console')) {
    pathname = pathname.replace('/console', '');
  }
  if (pathname.startsWith('/kiali')) {
    pathname = pathname.replace('/kiali', '');
  }

  const description = generateDescription(pathname, namespaces);

  const context: ContextRequest = {
    page_url: window.location.href,
    page_description: description,
    page_namespaces: namespaces
  };

  return context;
};

//App List of namespaces ${this.props.activeNamespaces.map(ns => ns.name).join(',')}
