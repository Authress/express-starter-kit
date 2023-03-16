
class AccountsRepository {
  async getAccount(accountId: string): Promise<Account> {
    const account: Account = {
      accountId,
      data: {}
    };
    return account;
  }

  async getAllAccounts(): Promise<Account[]> {
    return [];
  }

  async updateAccount(accountId: string, data: unknown): Promise<Account> {
    const account: Account = {
      accountId,
      data: {}
    };
    return account;
  }
  async deleteAccount(accountId: string): Promise<void> {

  }
  async createAccount(newAccountId: string, data: unknown): Promise<Account> {
    const account: Account = {
      accountId: newAccountId,
      data: {}
    };
    return account;
  }
}

export default new AccountsRepository();

export interface Account {
  accountId: string;
  data: unknown;
}