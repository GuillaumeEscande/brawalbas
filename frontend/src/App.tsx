import * as React from "react";

import { Authenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import { get } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth'


Amplify.configure({
  Auth: {
    Cognito: {
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID ?? '',
      userPoolId: import.meta.env.VITE_USER_POOL_ID ?? '',
      userPoolEndpoint: import.meta.env.VITE_USER_POOL_ENDPOINT ?? '',
      loginWith: {
          username: true,
          email: true,
          phone: true
      },
      signUpVerificationMethod: 'code'
    }
  },
  API: {
    REST: {
      hello: {
        endpoint: 'https://api.gescande.click/'
      }
    }
    
  }
}, {
  API: {
    REST: {
      headers: async () => {

        const session = await fetchAuthSession();
        const token = session.tokens?.idToken
        return { 'Authorization': token?.toString()! };
      }
    }
  }
});

async function getItem(): Promise<any> {
  try {
    const restOperation = get({ 
      apiName: 'hello',
      path: '' 
    });
    const response = await restOperation.response;
    return response.body.json();
  } catch (error) {
    return 'Error' + error;
  }
}

export default function App() {

  const [post, setPosts] = React.useState([]);

  React.useEffect(() => {
    getItem()
       .then((data) => {
          console.log(data.message);
          setPosts(data.message);
       })
       .catch((err) => {
          console.log(err.message);
       });
 }, []);

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main>
          <h1>Hello {user?.username}</h1>
          <button onClick={signOut}>Sign out</button>
          <p>{post}</p>
        </main>
      )}
    </Authenticator>
  );
};
