import logo from '../assets/logo.webp';
export { logo };
export default function Brand() {
  return (<><img className="lg" src={logo} alt="Logo Sira Yitte" width="46" height="46" /><span>Sira Yitte</span></>);
}
