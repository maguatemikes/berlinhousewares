import {redirect} from 'react-router';
import type {Route} from './+types/account_.logout';
import {clearAccountCache} from '~/lib/accountCache';

// if we don't implement this, /account/logout will get caught by account.$.tsx to do login
export async function loader() {
  return redirect('/');
}

export async function action({context}: Route.ActionArgs) {
  return context.customerAccount.logout();
}

// Wipe the in-memory account cache before the logout redirect so a different
// customer signing in on the same tab never sees the previous one's data.
export async function clientAction({serverAction}: Route.ClientActionArgs) {
  clearAccountCache();
  return serverAction();
}
