import HomeClient from './HomeClient';

const Home = async () => {
   // const result = await fetch(`${process.env.BASE_URL}/api/hello`, {
   //    method: 'GET',
   //    headers: { 'Content-type': 'application/json' },
   // }).then((res) => res.json());

   // console.log('result:', result);

   return <HomeClient numberOfPlayers={2} />;
};

export default Home;
