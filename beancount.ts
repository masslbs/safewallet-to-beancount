type Flag = "!" | "*";
export type MetaData = Record<string, string>;
export type Posting = {
  flag?: Flag;
  account: string;
  amount: string;
  currency: string;
  cost?: string;
  totalCost?: string;
  totalCostCurrency?: string;
  price?: string;
  comment?: string;
  metadata?: MetaData;
};
// A class representing a transaction in Beancount format.
export class Transaction {
  constructor(
    public args: {
      comment?: string;
      date: Date;
      flag: Flag;
      payee: string;
      narration?: string;
      tags?: string[];
      metadata?: MetaData;
      postings: Posting[];
    },
  ) {
  }
  toString() {
    const {
      comment,
      date,
      flag,
      payee,
      narration,
      tags,
      metadata,
      postings,
    } = this.args;

    // Format date as YYYY-MM-DD
    const dateStr = date.toISOString().split("T")[0];
    let transactionStr = "";

    // Add transaction comment if provided
    if (comment) {
      transactionStr += `; ${comment}\n`;
    }

    // Build transaction line
    transactionStr += `${dateStr} ${flag}`;

    // Add payee if provided or if narration exists
    transactionStr += ` "${payee}"`;

    // Add narration if provided
    if (narration) {
      transactionStr += ` "${narration}"`;
    }

    // Add tags if provided
    if (tags && tags.length > 0) {
      transactionStr += ` ${tags.map((tag) => `#${tag}`).join(" ")}`;
    }

    // Add transaction metadata if provided
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        transactionStr += `\n  ${key}: "${value}"`;
      }
    }

    // Build postings
    const postingsStr = postings.map(
      (
        {
          flag: postingFlag,
          account,
          amount,
          currency,
          cost,
          totalCost,
          totalCostCurrency,
          price,
          comment: postingComment,
          metadata: postingMetadata,
        },
      ) => {
        let postingLine = "  ";

        if (postingFlag) {
          postingLine += postingFlag + " ";
        }

        postingLine += account;

        if (amount) {
          postingLine += ` ${amount} ${currency}`;

          if (cost) {
            postingLine += ` {${cost}}`;
          } else if (totalCost) {
            postingLine += ` @@ ${totalCost} ${totalCostCurrency}`;
          }

          if (price) {
            postingLine += ` @ ${price}`;
          }
        }
        // Add posting comment if provided
        if (postingComment) {
          postingLine += ` ; ${postingComment}`;
        }

        let result = postingLine;

        // Add posting metadata if provided
        if (postingMetadata) {
          for (const [key, value] of Object.entries(postingMetadata)) {
            result += `\n    ${key}: "${value}"`;
          }
        }

        return result;
      },
    ).join("\n");

    return `${transactionStr}\n${postingsStr}`;
  }
}
