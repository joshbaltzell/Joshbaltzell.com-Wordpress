Draft for Josh to edit.

Title: Lemonade 3: A stand across the street
Excerpt: A game. A second lemonade stand opens across the street and sets its price by a rule you can see. 90 days to find out what its rule does to your best price.
Toy type: Game
Tags: game

---

On day 1 a second stand opens across the street. It doesn't learn. It follows a rule, and you choose which one: stay 25 cents under you, match you, hold $3.50, undercut but never go below $2.50, or stay 10% above you.

Visitors now pick a stand first, then buy or walk on. One in five always come to you and one in five always go to the other stand. Everyone else leans toward the cheaper stand: a 50-cent gap sends three in four of them there.

You can pick a price each day, or write a rule with up to three lines. Rules can look at what you sold yesterday or at the other stand's price yesterday, and they can match it or go under it. Step one day, a week, or to day 90.

A bot plays the same 90 days on its own street, against its own copy of the stand, which reacts to the bot instead of you. The bot uses Thompson sampling (William R. Thompson, 1933). It learns from what sells and knows nothing about the rule across the street.

At the end the toy works out the best price to hold against the stand you faced, and against the other rules on the list, with the same customers. The answers are often far apart. Once someone reacts to your price, the best price depends on their rule, not only on your customers.
