import { IExecWeb3mail, Contacts } from '@iexec/web3telegram';

export const test = async () => {
  if (!window.ethereum) {
    throw Error('missing injected ethereum provider in page');
  }

  await window.ethereum.request({
    method: 'eth_requestAccounts',
  });

  const web3mail = new IExecWeb3mail(window.ethereum);

  web3mail.fetchMyContacts().then((contacts: Contacts) => {
    console.log('contacts', contacts);
  });
};
