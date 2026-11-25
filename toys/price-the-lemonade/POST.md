Draft for Josh to edit.

Title: Price the Lemonade
Excerpt: A game. You don't know what people will pay, so how long does it take to find a good price, and what does finding it cost? Pick a price each day, or write a rule and let it run.
Toy type: Game
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

## Writing a pricing rule

Picking by hand is one way to play. The other is to write down how you'd decide, and let that run for the month.

Switch to "Write a rule". A rule has a start price and up to three lines, each of the form "If something about yesterday, then do something to the price." Each morning the lines are checked in order and the first one that matches wins. If none match, the price stays where it is. There's no code, just menus.

There are four examples to start from. "Hold one price" never moves. "Follow the crowd" raises the price when lots of people bought and lowers it when few did. "Climb until it hurts" keeps raising while profit goes up and steps back when it falls. "Cheap and cheerful" stays low and only ever drops.

The rule plays the same 30 days the bot plays, with the same visitors. Afterwards there's a line for each day saying which part of the rule fired, like "Day 7: line 1, sold 52 > 40, raised to $4.00." You can change a line and run it again on the same days, and the page keeps your last result so you can see whether the change helped.

Rules are blunter than you expect. A rule that reacts to yesterday's sales is reacting to noise as much as to price. There's a box to try every price once before the rule takes over, which is a small taste of what the bot does all month.

## How the customers think

The customers in this toy are a little human. Three findings from pricing research are built in, and each one can be turned off. The bot faces the same customers, but it doesn't know about any of this. It just learns from what sold.

Charm prices. People read prices from the left. $2.99 starts with a 2, so it feels nearer $2 than $3, even though it's a penny short of $3. The menu can include $2.99, $3.99, $4.99 and $5.99, and here a .99 price feels about 8 cents cheaper than it is. In Anderson and Simester's clothing catalog test, a $39 price outsold both $34 and $44.

Reference prices. Customers remember what they paid recently. A price above that feels like a loss, and losses weigh more than gains. So a raise costs more buyers than an equal cut wins back. This makes a jumpy pricing rule more expensive than it looks, and it's one reason a steady price can do well.

Anchoring and the decoy. The menu board shows a Grand cup at $9.00. Almost nobody buys it, and here nobody does. It's there to be seen. Next to it, a regular cup looks modest, so people will pay a little more for one.

The sizes in this model are illustrative. They're kept small, at most a few extra or lost buyers in every 60 visitors. The studies found these effects in specific settings, such as a clothing catalog and a magazine subscription offer, and they won't hold the same way at every lemonade stand.

Every round has a seed. Add `?seed=` and the number to the address to replay the same month.

Credits: the bot uses Thompson sampling, first described by William R. Thompson in 1933.

## References

- Manoj Thomas and Vicki Morwitz, "Penny Wise and Pound Foolish: The Left-Digit Effect in Price Cognition," *Journal of Consumer Research* 32, no. 1 (2005): 54–64.
- Eric T. Anderson and Duncan I. Simester, "Effects of $9 Price Endings on Retail Sales: Evidence from Field Experiments," *Quantitative Marketing and Economics* 1, no. 1 (2003): 93–110.
- Daniel Kahneman and Amos Tversky, "Prospect Theory: An Analysis of Decision under Risk," *Econometrica* 47, no. 2 (1979): 263–291.
- Gurumurthy Kalyanaram and Russell S. Winer, "Empirical Generalizations from Reference Price Research," *Marketing Science* 14, no. 3 (1995): G161–G169.
- Joel Huber, John W. Payne and Christopher Puto, "Adding Asymmetrically Dominated Alternatives: Violations of Regularity and the Similarity Hypothesis," *Journal of Consumer Research* 9, no. 1 (1982): 90–98.
- Dan Ariely, *Predictably Irrational* (HarperCollins, 2008), chapter 1, the Economist subscription example.
