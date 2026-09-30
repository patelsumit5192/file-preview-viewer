-- Enterprise Analytics & Window Aggregation Queries
WITH RegionalAggregates AS (
    SELECT 
        region_id,
        DATE_TRUNC('month', transaction_date) AS txn_month,
        SUM(amount_usd) AS total_revenue,
        COUNT(DISTINCT customer_id) AS active_accounts,
        RANK() OVER (PARTITION BY region_id ORDER BY SUM(amount_usd) DESC) as revenue_rank
    FROM enterprise_transactions
    WHERE transaction_status = 'COMPLETED'
      AND transaction_date >= '2026-01-01'
    GROUP BY region_id, DATE_TRUNC('month', transaction_date)
)
SELECT 
    r.region_name,
    a.txn_month,
    a.total_revenue,
    a.active_accounts
FROM RegionalAggregates a
JOIN global_regions r ON a.region_id = r.id
WHERE a.revenue_rank <= 3
ORDER BY a.total_revenue DESC;
