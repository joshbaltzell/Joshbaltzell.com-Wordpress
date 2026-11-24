Draft for Josh to edit.

Title: Price the Lemonade
Excerpt: You don't know what people will pay, so how long does it take to find a good price, and what does finding it cost?
Toy type: Toy
Tags: toy

---

You run a lemonade stand for 30 days. Each morning you pick a price between $2.00 and $6.00. A cup costs $1.20 to make. At the end of the day you see how many people came by, how many bought, and what you made.

What you don't see is the curve: how likely a visitor is to buy at each price. You have to learn it by charging prices and watching. Every day spent on a price that turns out to be wrong is money you didn't make. Every day spent on the price you already like is a day you didn't learn anything new. That tension is the whole toy.

A bot plays beside you. It sees the same visitors on the same days, so the only difference between you is how you choose.

The bot keeps a rough guess for each price: how often a visitor buys there. At the start the guesses are wide open, because it knows nothing. Each morning it draws one plausible value from each guess, works out what each price would earn if those draws were true, and charges the best one.

Then it updates the guess for that price with what happened. Prices it has tried a lot get narrow guesses. Prices it hasn't tried stay wide, so now and then a wide guess draws high and the bot tries that price again. It explores where it is unsure and stops exploring once the evidence is clear. Nobody tells it when to stop.

Rounds cycle through four hidden curves. One is steep. One is flat, where several prices earn about the same. One has a cliff at $5.00. One has a hot week in the middle of the month, which a single fixed price can't follow.

Things to look for:

- How many days it takes each of you to settle, and whether you settle on the same price.
- The flat round. The bot keeps testing there for a long time, and it's right to, because the prices really are close.
- "Left on the table": how far each of you finished from the best single price, chosen in hindsight.

People often stop trying new prices after a few days. That's worth noticing in your own runs.

Every round has a seed. Add `?seed=` and the number to the address to replay the same month.

Credits: the bot uses Thompson sampling, first described by William R. Thompson in 1933.
